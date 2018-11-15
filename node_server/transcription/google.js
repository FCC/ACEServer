/*
                                 NOTICE

This (software/technical data) was produced for the U. S. Government under
Contract Number HHSM-500-2012-00008I, and is subject to Federal Acquisition
Regulation Clause 52.227-14, Rights in Data-General. No other use other than
that granted to the U. S. Government, or to those acting on behalf of the U. S.
Government under that Clause is authorized without the express written
permission of The MITRE Corporation. For further information, please contact
The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive, 
McLean, VA 22102-7539, (703) 983-6000.

                        ©2018 The MITRE Corporation.
*/

var Speech = require('@google-cloud/speech');
var GrowingFile = require('growing-file');
var unpipe = require('unpipe');
const speech = Speech();
const maxTimeoutForReconnect = 45000;
const growingFileOffset = -5000; // GrowingFile's period has to be less than the reconnect timeout.

function Google(file) {
  this.file = file;
  this.gfWavPolling = null;
  this.growingWav = null;
  this.lastResults = {};
  this.request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'en-US'
    },
    interimResults: true, // If you want interim results, set this to true
    verbose: true
  };
};

Google.prototype.start = function (callback) {
  this.done = false;
  this.growingWav = GrowingFile.open(this.file, {
    timeout: maxTimeoutForReconnect + growingFileOffset,
    interval: 100
  });
  this.growingWav.pipe(this.speechStream(callback));

  this.gfWavPolling = setTimeout(this.reconnectStreams, maxTimeoutForReconnect, this, "timeout", callback);

  this.growingWav.on('end', () => {
    console.log("clearing reconnection timer");
    clearTimeout(this.gfWavPolling);
    this.done = true;
  });
};


Google.prototype.reconnectStreams = function (that, reason, callback) {
  clearTimeout(that.gfWavPolling);
  unpipe(that.growingWav);
  if (!that.done) {
    console.log("google startnew stream because of " + reason);
    var gstream = that.speechStream.call(that, callback);
    that.growingWav.pipe(gstream);
    that.gfWavPolling = setTimeout(that.reconnectStreams, maxTimeoutForReconnect, that, "timeout", callback); //default reason is timeout. 
  }
};


Google.prototype.speechStream = function (callback) {
  return speech.createRecognizeStream(this.request)
    .on('error', (error) => {
      console.log("Google Error: " + error);
      console.log('What should I do?');
    })
    .on('data', (data) => {
      if (!data.error) {
        if (data.results[0]) { //test to make sure results aren't empty. 
          var results = {
            'transcript': data.results[0].transcript,
            'final': data.results[0].isFinal,
            'timestamp': new Date()
          };
          if (results.final) {
            console.log('a REAL final');
            this.reconnectStreams(this, "final", callback);
          }
          this.lastResults = results;
          callback(results);
        }
      } else {
        console.log("Error: " + JSON.stringify(data));
        console.log('Stopping Google STT due to error');
        if (data.error.code === 11) {
          if (this.lastResults.final === false) {
            console.log('a FORCED final');
            this.lastResults.final = true;
            callback(this.lastResults);
          }
          this.reconnectStreams(this, "Restartable Error", callback);
        } else {
          this.done = true;
        }
      }
    });
};

module.exports = Google;