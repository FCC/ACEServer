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

var request = require('request');
var fs = require('fs');
var log4js = require('log4js');
var adminLogger = log4js.getLogger('admin');
var mysql = require('mysql');
var request = require('request');
var decode = require('./../utils/decode');

module.exports = function (io, nconf) {

  if (decode(nconf.get('sttService') === 'enabled')) {
    var Watson = require('../transcription/watson');
    var Google = require('../transcription/google');
    var Azure = require('../transcription/azure')
  } else {
    console.log('STT Service is currently DISABLED. This allows the ACE Quill web server to be run without including the STT node_modules.');
  }

  adminLogger.debug("Entering admin.js");

  io.on("connection", (socket) => {
    adminLogger.debug("Incoming Socket.IO:connection");

    socket.on('get-stt-configs', () => {
      adminLogger.debug("Incoming Socket.IO:get-stt-configs");
      try {
        var azure = JSON.parse(fs.readFileSync('./stt_configs/microsoft-bingspeech.json'));
        var google = JSON.parse(fs.readFileSync('./stt_configs/google-speech.json'));
        var watson = JSON.parse(fs.readFileSync('./stt_configs/ibm-watson.json'));
        io.to(socket.id).emit('load-stt-azure-configs', azure);
        io.to(socket.id).emit('load-stt-google-configs', google);
        io.to(socket.id).emit('load-stt-watson-configs', watson);
      } catch (err) {
        adminLogger.error("Error parsing stt_configs (azure, watson and google) JSON");
        adminLogger.error(err);
      }
    });


    socket.on('update-configs', (data) => {
      adminLogger.debug("Incoming Socket.IO:update-configs");
      adminLogger.debug(JSON.stringify(data));
      fs.writeFile('./stt_configs.json', JSON.stringify(data), (err) => {
        if (err) {
          adminLogger.error("Error writing ./stt_configs.json");
          adminLogger.error(err.message);
          return;
        }
        adminLogger.debug("Configs saved in ./stt_configs.json");
        io.to(socket.id).emit('save-success');
      });
    });

    socket.on('update-azure-configs', (data) => {
      adminLogger.debug("Incoming Socket.IO:update-azure-configs");
      adminLogger.debug(JSON.stringify(data));
      var azure = {};
      azure.speech_client_id = data.speech_client_id;
      fs.writeFile('./stt_configs/microsoft-bingspeech.json', JSON.stringify(azure, null, 2), (err) => {
        if (err) {
          adminLogger.error("Error writing ./stt_configs/microsoft-bingspeech.json");
          adminLogger.error(err.message);
          return;
        }
        adminLogger.debug("Azure config saveed to ./stt_configs/microsoft-bingspeech.json");
        io.to(socket.id).emit('save-stt-success', "Azure");
      });
    });

    socket.on('update-google-configs', (data) => {
      adminLogger.debug("Incoming Socket.IO:update-google-configs");
      adminLogger.debug(JSON.stringify(data));
      var google = {};
      google.type = data.type;
      google.project_id = data.project_id;
      google.private_key_id = data.private_key_id;
      google.private_key = data.private_key;
      google.client_email = data.client_email;
      google.client_id = data.client_id;
      google.auth_uri = data.auth_uri;
      google.token_uri = data.token_uri;
      google.auth_provider_x509_cert_url = data.auth_provider_x509_cert_url;
      google.client_x509_cert_url = data.client_x509_cert_url;

      fs.writeFile('./stt_configs/google-speech.json', JSON.stringify(google, null, 2), (err) => {
        if (err) {
          adminLogger.error("Error writing ./stt_configs/google-speech.json");
          adminLogger.error(err.message);
          return;
        }
        adminLogger.debug("Google config saved to ./stt_configs/google-speech.json");
        io.to(socket.id).emit('save-stt-success', "Google");
      });
    });

    socket.on('update-watson-configs', (data) => {
      adminLogger.debug("Incoming Socket.IO:update-watson-configs");
      adminLogger.debug(JSON.stringify(data));

      var watson = {};
      watson.username = data.username;
      watson.password = data.password;
      fs.writeFile('./stt_configs/ibm-watson.json', JSON.stringify(watson, null, 2), (err) => {
        if (err) {
          adminLogger.error("Error writing ./stt_configs/ibm-watson.json");
          adminLogger.error(err.message);
          return;
        }
        adminLogger.debug("Watson config to ./stt_configs/ibm-watson.json");
        io.to(socket.id).emit('save-stt-success', "Watson");
      });
    });


    socket.on('test-stt-engines', (data) => {
      adminLogger.debug("Incoming Socket.IO:test-stt-engines");
      if (decode(nconf.get('sttService')) === 'enabled') {
        var filepath = 'public/sounds/rain_in_spain.wav';

        var aconfig = JSON.parse(fs.readFileSync('./stt_configs/microsoft-bingspeech.json'));
        aconfig.token = aconfig.speech_client_id;
        aconfig.file = filepath;
        var azure = new Azure(aconfig);
        azure.start(function (data) {
          data.engine = 'azure';
          sttResults(data);
        });

        var google = new Google(filepath);
        google.start(function (data) {
          data.engine = 'google';
          sttResults(data);
        });

        var wconfig = JSON.parse(fs.readFileSync('./stt_configs/ibm-watson.json'));
        wconfig.contentType = "audio/wav; rate=16000";
        wconfig.smartFormatting = true;
        var watson = new Watson(filepath, wconfig);
        watson.start(function (data) {
          data.engine = 'watson';
          sttResults(data);
        });
      } else {
        console.log('STT Engines are disabled');
      }

    });
    socket.on('test-resources', (data) => {
      testAsterisk();
      testMySQL();
    });

    function sttResults(data) {
      if (data.final) {
        io.to(socket.id).emit('test-stt-engines-results', data);
      }
    }

    function testAsterisk() {
      var results = 'fail'
      var oldTLSValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      request('https://'+decode(nconf.get('asterisk:host'))+'/ws', function (err, res, body) {
        if (!err) {
          results = 'pass';
        }
        io.to(socket.id).emit('test-resources-asterisk-results', results);
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = oldTLSValue;
      });
    }

    function testMySQL() {
      var results = 'fail'
      var mySqlConnection = mysql.createConnection({
        host: decode(nconf.get('mysql:host')),
        user: decode(nconf.get('mysql:user')),
        password: decode(nconf.get('mysql:password')),
        database: decode(nconf.get('mysql:database')),
        debug: false
      });

      mySqlConnection.connect(function (err) {
        if (!err) {
          results = 'pass';
        }
        io.to(socket.id).emit('test-resources-mysql-results', results);
      });

      mySqlConnection.end();
    }

  });
};
