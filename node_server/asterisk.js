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

var asteriskManager = require('asterisk-manager');
var log4js = require('log4js');
var nconf = require('nconf');
var fs = require('fs');
var util = require('util');
var Watson = require('./transcription/watson');
var Google = require('./transcription/google');
var Azure = require('./transcription/azure')
var moment = require('moment');
var mysql = require('mysql');
var HashMap = require('hashmap');
var decode = require('./utils/decode');
var validator = require('./utils/validator');

var channelToDigitMap = new HashMap();
var channelToDestChannelMap = new HashMap();

var logger = log4js.getLogger('asterisk');

// Set log4js level from the config file
logger.setLevel(decode(nconf.get('debuglevel'))); //log level hierarchy: ALL TRACE DEBUG INFO WARN ERROR FATAL OFF
logger.trace('TRACE messages enabled.');
logger.debug('DEBUG messages enabled.');
logger.debug('INFO messages enabled.');
logger.warn('WARN messages enabled.');
logger.error('ERROR messages enabled.');
logger.fatal('FATAL messages enabled.');
logger.debug('Using config file: ' + cfile);

var transcriptFilePath = decode(nconf.get('transcriptFilePath'));
var wavFilePath = decode(nconf.get('wavFilePath'));

var ami = null;

function init_ami() {
  if (ami === null) {
    try {
      ami = new asteriskManager(
        decode(nconf.get('asterisk:port')),
        decode(nconf.get('asterisk:host')),
        decode(nconf.get('asterisk:user')),
        decode(nconf.get('asterisk:password')),
        true);

      ami.keepConnected();

      // Define event handlers here
      ami.on('managerevent', handle_manager_event);

      logger.debug('Connected to Asterisk');

    } catch (exp) {
      logger.debug('Init AMI error' + JSON.stringify(exp));
    }
  }
}

init_ami();

function handle_manager_event(evt) {

  switch (evt.event) {

    case ('DialEnd'):
      /*
       * Listen for DialEnd to indicate a connected call.
       */
      logger.debug('****** Processing AMI DialEnd ******');

      if (evt.dialstatus === 'ANSWER') {

        /*
         * Get the channel names (channel and destchannel)
         * Send AMI Monitor events for those channels
         *
         * Message Format
         * Action: Monitor
         * [ActionID:] <value>
         * Channel: <value>
         * [File:] <value>
         * [Format:] <value>
         * [Mix:] <value>
         */

        logger.debug('Call connected');
        if (validator.isChannel(evt.channel) && validator.isChannel(evt.destchannel)) {
          // Populate the map containing destchannel => EMPTY as an initial value
          channelToDigitMap.set(evt.destchannel, "EMPTY");
          logger.debug("DialEnd - setting channelToDigitMap: " + evt.destchannel + " => " + "EMPTY");

          /*
           * Populate the map containing channel => destchannel
           * We need this because in the Hangup where we do the db update, we only have access to the
           * channel, but, also need access to the destchannel.
           */
          logger.debug("DialEnd - setting channelToDestChannelMap: " + evt.channel + " => " + evt.destchannel);
          channelToDestChannelMap.set(evt.channel, evt.destchannel);

          // Build unique filenames using timestamp and channel name
          var now = moment().format("MM-DD-YYYY_HH-mm-ss");
          var sipFilename = now + "_" + evt.channel;
          sipFilename = sipFilename.replace(/\//g, '-');
          logger.debug('sipFilename: ' + sipFilename);

          // Open the file for the SIP transcript text
          var fd_sip = fs.open(transcriptFilePath + sipFilename + '.txt', 'w', function (err, sfd) {

            if (err) {
              logger.error("Error opening SIP transcript text: " + JSON.stringify(err));
            }
            logger.debug("SIP transcript file opened successfully!");
          });


          var pstnFilename = now + "_" + evt.destchannel;
          pstnFilename = pstnFilename.replace(/\//g, '-');
          logger.debug('pstnFilename: ' + pstnFilename);

          // Open the file for the PSTN transcript text
          var fd_pstn = fs.open(transcriptFilePath + pstnFilename + '.txt', 'w', function (err, sfd) {

            if (err) {
              logger.error("Error opening PSTN transcript text");
            }

            logger.debug("PSTN transcript file opened successfully!");
          });

          logger.debug('channel 1: ' + evt.channel);
          logger.debug('channel 2: ' + evt.destchannel);

          var pstnCommand = {
            "Action": "Monitor",
            "Channel": evt.destchannel,
            "File": wavFilePath + pstnFilename + "-pstn",
            "Format": "wav16"
          };

          logger.debug("Outgoing AMI Action for PSTN: " + JSON.stringify(pstnCommand));

          sendAmiAction(pstnCommand);

          // Extract the extension from the DialEnd, looks like this:   channel: 'SIP/5001-00000000'
          var extString = evt.channel;
          var extensionArray = extString.split(/[\/,-]/);
          var ext = extensionArray[1];

          var mySqlConnection = openMySqlConnection();
          var sql = "(SELECT id, extension, stt_engine, delay, default_device FROM device_settings WHERE extension = ?) " +
            "UNION " +
            "(SELECT id, extension, stt_engine, delay, default_device FROM device_settings WHERE default_device = 1) " +
            "LIMIT 1;";

          mySqlConnection.query(sql, ext, function (err, result) {
            if (err) {
              throw err;
              logger.error("Error in UPDATE statement: " + JSON.stringify(err));
            } else {
              logger.debug("MySQL INSERT result: " + JSON.stringify(result));
              var sttSettings = {
                sttEngine: result[0] ? result[0].stt_engine: "UNKNOWN",
                delay: result[0] ? result[0].delay : "0"
              }
              startTranscription(ext, sipFilename, pstnFilename, sttSettings, evt.channel);
              var milliseconds = (new Date).getTime();
              // Insert MySQL insert here
              logger.debug("DialEnd MySQL Data");
              logger.debug("Device ID: 1");
              logger.debug("Extension: " + ext);
              logger.debug("Source channel: " + evt.channel);
              logger.debug("Dest channel: " + evt.destchannel);
              logger.debug("Call start: " + milliseconds);
              logger.debug("Unique ID: " + evt.uniqueid);
              logger.debug("Dest Phone number: " + evt.destcalleridnum);
              logger.debug("STT Engine: " + sttSettings.sttEngine);
              logger.debug("STT Delay: " + sttSettings.delay);
              logger.debug("Call Accuracy: 100%");
              logger.debug("Transcript File Path: " + transcriptFilePath);
              logger.debug("Transcript File: " + pstnFilename + ".txt");
              logger.debug("Wav File Path: " + wavFilePath);
              logger.debug("Wav File: " + pstnFilename + ".wav16");

              var unixEpoch = (new Date).getTime();
              var buildNumber = null;
              var gitCommit = null;
              var deviceId = null;

              mySqlConnection.query('SELECT build_number, git_commit, device_id FROM registration_data WHERE extension = ?', ext,
                function (err, result) {

                  if (err) {
                    logger.debug("Error in SELECT " + err);
                    throw err;
                  } else {
                    logger.debug("SELECT success: " + JSON.stringify(result));
                    buildNumber = result[0].build_number;
                    logger.debug("buildNumber: " + buildNumber);

                    gitCommit = result[0].git_commit;
                    logger.debug("gitCommit: " + gitCommit);

                    deviceId = result[0].device_id;
                    logger.debug("deviceId: " + deviceId);

                    var mySet = {
                      device_id: deviceId,
                      extension: ext,
                      src_channel: evt.channel,
                      dest_channel: evt.destchannel,
                      unique_id: evt.uniqueid,
                      dest_phone_number: evt.destcalleridnum,
                      stt_engine: sttSettings.sttEngine,
                      call_accuracy: 100,
                      added_delay: sttSettings.delay,
                      transcription_file_path: transcriptFilePath,
                      transcription_file: pstnFilename + ".txt",
                      audio_file_path: wavFilePath,
                      audio_file: pstnFilename + "-pstn-in.wav16",
                      build_number: buildNumber,
                      git_commit: gitCommit
                    };

                    logger.debug('Call data: ' + JSON.stringify(mySet));

                    mySqlConnection.query('INSERT INTO research_data SET ?', mySet,
                      function (err, result) {
                        if (err) {
                          logger.debug("Error in INSERT: " + JSON.stringify(err));
                        } else {
                          logger.debug('INSERT result: ' + JSON.stringify(result));
                        }
                      });

                    mySqlConnection.end(function (err) {
                      // The connection is terminated now
                      if (err) {
                        logger.debug("Error closing MySQL connection: " + JSON.stringify(err));
                      } else {
                        logger.debug("MySQL connection closed");
                      }
                    });
                  }
                });

            }
          });
        }
      }
      break;
    case ('Hangup'):
      /*
       * Note - We will receive two hangups, once per channel, so,
       * just process them one at a time.
       */

      /*
       *  Send a StopMonitor action here:
       *
       *  Message Format
       *  Action: StopMonitor
       *  [ActionID:] <value>
       *  Channel: <value>
       *
       */

      logger.debug('****** Processing AMI Hangup ******');

      /*
       * Extract the extension from the Hangup.  Note, we will get two hangup messages:
       * 1. channel: 'SIP/5001-00000000'
       * 2. channel: 'SIP/twilio0-00000001',
       *
       * I'm assuming we want to send the hangup based on the SIP-side hangup.
       */
      var extString = evt.channel;
      var extensionArray = extString.split(/[\/,-]/);
      var ext = extensionArray[1];

      if (ext.includes("twilio") === false) {
        sendAmiAction({
          "Action": "SendText",
          "Channel": evt.channel,
          "Message": JSON.stringify({
            'event': 'end-call',
            'extension': ext,
            'time': new Date()
          })
        });
      }
      /*
       * Since we get two hangups, we only one call the database insert once.  For
       * the SIP side of the call, the uniqueid and destunique are equal.
       *
       */
      if ((evt.uniqueid === evt.linkedid) && validator.isUniqueId(evt.uniqueid)) {

        var sql = "UPDATE research_data SET call_end = CURRENT_TIMESTAMP(), ";
        sql += "call_duration = UNIX_TIMESTAMP(call_end) - UNIX_TIMESTAMP(call_start)";
        sql += " WHERE unique_id = ?;";

        var params = evt.uniqueid;

        logger.debug("Hangup SQL statement: " + sql);
        logger.debug("Hangup SQL statement: " + params);

        var mySqlConnection = openMySqlConnection();

        mySqlConnection.query(sql, params, function (err, result) {
          if (err) {
            throw err;
            logger.error("Error in UPDATE statement: " + JSON.stringify(err));
          } else {
            logger.debug("MySQL INSERT result: " + JSON.stringify(result));
          }
        });

        mySqlConnection.end(function (err) {
          // The connection is terminated now
          if (err) {
            logger.error("Error closing MySQL connection: " + JSON.stringify(err));
          } else {
            logger.debug("MySQL connection closed in asterisk.js");
          }
        });
      }

      // This should be the channel containing twilio
      if (channelToDigitMap.has(evt.channel)) {
        logger.debug("Hangup, - deleting " + evt.channel + " from channelToDigitMap");
        channelToDigitMap.delete(evt.channel);
      }

      if (channelToDestChannelMap.has(evt.channel)) {
        logger.debug("Hangup, - deleting " + evt.channel + " from channelToDestChannelMap");
        channelToDestChannelMap.delete(evt.channel);
      }


      break;

    case ('DTMFBegin'):
      /*
        Event: DTMFBegin
        Privilege: dtmf,all
        Channel: SIP/twilio0-0000000d
        ChannelState: 6
        ChannelStateDesc: Up
        CallerIDNum: 7034548537
        CallerIDName: <unknown>
        ConnectedLineNum: 8449060685
        ConnectedLineName: ntldevsip2
        Language: en
        AccountCode:
        Context: from-twilio
        Exten:
        Priority: 1
        Uniqueid: 1507661182.19
        Linkedid: 1507661182.18
        Digit: 1
        Direction: Sent
      */
      logger.debug('****** Processing AMI DTMFBegin ******');
      // logger.debug("Received DTMF: " + util.inspect(evt, false, null));

      logger.debug("Contents of map before:");
      channelToDigitMap.forEach(function (value, key) {
        logger.debug(key + " => " + value);
      });

      /*
       * Extract the extension from the Hangup.  Note, we will get two hangup messages:
       * 1. channel: 'SIP/5001-00000000'
       * 2. channel: 'SIP/twilio0-00000001',
       *
       * I'm assuming we want to send the hangup based on the SIP-side hangup.
       */
      var extString = evt.channel;
      var extensionArray = extString.split(/[\/,-]/);
      var ext = extensionArray[1];

      //
      if (ext.includes("twilio") === true) {
        /* Store the channel => digit map here
         *  Originally set to EMPTY to make sure we only set it once
         */
        if (channelToDigitMap.get(evt.channel) === "EMPTY") {
          logger.debug("DTMFBegin - setting channelToDigitMap " + evt.channel + " => " + evt.digit);
          channelToDigitMap.set(evt.channel, evt.digit);
          //Validate both digit and linkedid (linkedid is same Format of uniqueid) are numbers.
          if (validator.isDtmfDigit(evt.digit) && validator.isUniqueId(evt.linkedid)) {
            var sql = "UPDATE research_data SET scenario_number = ? WHERE unique_id = ?;";
            var params = [evt.digit, evt.linkedid];
            logger.debug("DTMF SQL statement: " + sql);
            logger.debug("DTMF SQL params: " + params);
            var mySqlConnection = openMySqlConnection();
            mySqlConnection.query(sql, params, function (err, result) {
              if (err) {
                throw err;
                logger.error("Error in UPDATE statement: " + JSON.stringify(err));
              } else {
                logger.debug("MySQL UPDATE result: " + JSON.stringify(result));
              }
            });

            mySqlConnection.end(function (err) {
              // The connection is terminated now
              if (err) {
                logger.error("Error closing MySQL connection: " + JSON.stringify(err));
              } else {
                logger.debug("MySQL connection closed in asterisk.js");
              }
            });
          }
        } else {
          logger.debug("No match in the channelToDigitMap");
        }
      }

      logger.debug("Contents of map after:");
      channelToDigitMap.forEach(function (value, key) {
        logger.debug(key + " => " + value);
      });


      break;

    case ('UserEvent'):
      logger.debug('AMI Event: UserEvent');
      if (evt.userevent === 'SIPMESSAGE') {
        /*
        { event: 'UserEvent',
          privilege: 'user,all',
          channel: 'Message/ast_msg_queue',
          channelstate: '6',
          channelstatedesc: 'Up',
          calleridnum: '<unknown>',
          calleridname: '<unknown>',
          connectedlinenum: '<unknown>',
          connectedlinename: '<unknown>',
          language: 'en',
          accountcode: '',
          context: 'sip-message',
          exten: '9999',
          priority: '6',
          uniqueid: '1513789882.0',
          linkedid: '1513789882.0',
          userevent: 'SIPMESSAGE',
          eventcustom: 'register-ext',
          extension: '5001',
          buildnbr: '1047',
          gitcommit: 'c773c8dbc0dcf8c06938542ac06d6ee30a3ca217',
          deviceid: '17ee4e3d9b203b7a' }
        */
        if (evt.eventcustom && evt.extension && evt.buildnbr && evt.gitcommit && evt.deviceid) {
          var sql = 'INSERT INTO registration_data SET ? ON DUPLICATE KEY UPDATE build_number = ?, git_commit = ?, device_id = ?';

          var extension = parseInt(evt.extension);
          var buildNumber = evt.buildnbr.toString();
          var gitCommit = evt.gitcommit.toString();
          var deviceId = evt.deviceid.toString();

          var myRegisterData = {
            extension: extension,
            build_number: buildNumber,
            git_commit: gitCommit,
            device_id: deviceId
          };

          var mySqlConnection = openMySqlConnection();
          mySqlConnection.query(sql, [myRegisterData, buildNumber, gitCommit, deviceId], function (err, result) {
            if (err) {
              throw err;
              logger.error("Error in UPDATE statement: " + JSON.stringify(err));
            } else {
              logger.debug("MySQL UPDATE result: " + JSON.stringify(result));
            }
          });

          mySqlConnection.end(function (err) {
            // The connection is terminated now
            if (err) {
              logger.error("Error closing MySQL connection: " + JSON.stringify(err));
            } else {
              logger.debug("MySQL connection closed in asterisk.js");
            }
          });
        }
      }

      break;
    default:
      break;
  }
}

function sendAmiAction(obj) {
  ami.action(obj, function (err, res) {
    if (err) {
      logger.error('AMI Action error ' + JSON.stringify(err));
    }

  });
}

function startTranscription(extension, sipFilename, pstnFilename, sttSettings, channel) {
  var pstn;
  var engineCd = 'A';
  var file = wavFilePath + pstnFilename + '-pstn-in.wav16';

  logger.debug('Entering startTranscription() for extension: ' + extension + ', and file: ' + file);
  logger.debug("STT Engine: " + sttSettings.sttEngine);
  logger.debug("Delay: " + sttSettings.delay);
  switch (sttSettings.sttEngine) {
    case 'GOOGLE':
      pstn = new Google(file);
      engineCd = 'G';
      logger.debug("Connected to Google");
      break;
    case 'WATSON':
      try {
        var config = JSON.parse(fs.readFileSync('./stt_configs/ibm-watson.json'));
        config.contentType = "audio/wav; rate=16000";
        config.smartFormatting = true;
        pstn = new Watson(file, config);
        engineCd = 'W';
        logger.debug("Connected to Watson");
      } catch (err) {
        logger.debug('Error loading stt_configs/ibm-watson.json');
        logger.debug(err);
      }
      break;
    case 'AZURE':
      try {
        var config = JSON.parse(fs.readFileSync('./stt_configs/microsoft-bingspeech.json'));
        config.token = config.speech_client_id;
        config.file = file;

        pstn = new Azure(config);
        engineCd = 'A';
        logger.debug("Connected Azure");
      } catch (err) {
        logger.debug('Error loading stt_configs/microsoft-bingspeech.json');
        logger.debug(err);
      }
      break;
    default:
      var now = new Date();
      sendAmiAction({
        "Action": "SendText",
        "Channel": channel,
        "Message": JSON.stringify({
          'event': 'message-stream',
          'extension': extension,
          'transcript': 'Extension: '+extension+' has not been configured for ACE Quill. Please add this extension in the administrative research portal.',
          'source': 'PSTN',
          'sttengine': '?',
          'final': true,
          'timestamp': now,
          'msgid': now.getTime()
        })
      });
      return;
  }
  var now = new Date();
  sendAmiAction({
    "Action": "SendText",
    "Channel": channel,
    "Message": JSON.stringify({
      'event': 'message-stream',
      'extension': extension,
      'transcript': '---Answered---',
      'source': 'PSTN',
      'sttengine': engineCd,
      'final': true,
      'timestamp': now,
      'msgid': now.getTime()
    })
  });


  var pstnMsgTime = 0;
  pstn.start(function (data) {
    if (pstnMsgTime === 0) {
      var d = new Date();
      pstnMsgTime = d.getTime();
    }
    data.event = "message-stream"
    data.source = "PSTN";
    data.extension = extension;
    data.msgid = pstnMsgTime;
    data.sttengine = engineCd;
    var delay = sttSettings.delay * 1000;
    setTimeout(function () {
      if (channel) {
        sendAmiAction({
          "Action": "SendText",
          "ActionID": data.msgid,
          "Channel": channel,
          "Message": JSON.stringify(data)
        });
      }
    }, delay);
    if (data.final) {
      logger.debug('PSTN: ' + data.transcript);
      fs.appendFileSync(transcriptFilePath + pstnFilename + '.txt', +data.timestamp + ': ' + data.transcript + '\n');
      //reset pstnMsgTime;
      pstnMsgTime = 0;
    }
  });
}

function openMySqlConnection() {
  var mySqlConnection = mysql.createConnection({
    host: decode(nconf.get('mysql:host')),
    user: decode(nconf.get('mysql:user')),
    password: decode(nconf.get('mysql:password')),
    database: decode(nconf.get('mysql:database')),
    debug: false
  });

  mySqlConnection.connect(function (err) {
    if (err) {
      logger.error("MySQL connection error in asterisk.js");
      logger.error(err);
    } else {
      logger.debug("Connected to MySQL in asterisk.js");
    }
  });

  return (mySqlConnection);
}
