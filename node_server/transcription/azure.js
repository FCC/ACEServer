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

var stt = require('./BingStt/BingSpeechWebSocketAPIWrapper.js');
var fs = require('fs');

const maxTimeoutForReconnect = 60000;
var GrowingFile = require('growing-file');


class Azure {
    constructor(config) {
        this.file = config.file;
        this.token = config.token;
        this.growingWav = null;
        this.rs = null;
        this.stt = null;
    }

    start(callback) {
        console.log('start');
        this.stt = new stt(this.token, {
            format: 'simple',
            language: 'en-US'
        });

        this.registerHandlers(callback);
        this.stt.open();
    }



    registerHandlers(callback) {
        this.stt.on('connect', () => {
            console.log("New connect");
            if (this.growingWav === null) {
                this.growingWav = GrowingFile.open(this.file, {
                    timeout: maxTimeoutForReconnect,
                    interval: 100
                });
                this.stt.startDetection(this.growingWav);
            }
        });

        this.stt.on('recognized', (data) => {
            if (data.RecognitionStatus === 'Success') {
                var results = {
                    'transcript': data.DisplayText,
                    'guid': data.Guid,
                    'final': true,
                    'timestamp': new Date()
                };
                callback(results);
            }
        });

    }
}

module.exports = Azure;