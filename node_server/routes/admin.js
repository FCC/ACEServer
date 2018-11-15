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

var express = require('express');
var fs = require('fs');
var json2csv = require('json2csv');
var decode = require('./../utils/decode');
var validator = require('./../utils/validator');
var bcrypt = require('bcrypt')
var router = express.Router();

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    if (req.originalUrl.substr(-1) == '/') {
      res.redirect('login');
    } else {
      res.redirect('./admin/login');
    }
  }
}

router.get('/', restrict, function (req, res) {
  res.redirect('./configs');
});


router.get('/cdr', restrict, function (req, res) {
  res.render('pages/admin/cdr', {
    role: req.session.role
  });
})

router.get('/getallcdrrecs', restrict, function (req, res) {
  console.log('GET /getallcdrrecs');
  var query = 'SELECT * FROM asterisk.bit_cdr ORDER BY calldate';
  var params = [];
  if (req.query.start && req.query.end) {
    query = 'SELECT * FROM asterisk.bit_cdr WHERE (calldate BETWEEN ? AND ?)';
    params = [req.query.start, req.query.end];
  }
  req.connection.query(query, params, function (err, rows, fields) {
    if (err) {
      console.log("/getallcdrrecs an error has occurred", err);
      return res.status(500).send({
        'message': 'MySQL error'
      });
    } else if (rows.length > 0) {
      //success
      if (req.query.download) {
        JSON.stringify(rows);

        // Column names for the CSV file.
        var csvFields = ['calldate', 'clid', 'src',
          'dst', 'dcontext', 'channel',
          'dstchannel', 'lastapp', 'lastdata',
          'duration', 'billsec', 'disposition',
          'amaflags', 'accountcode', 'userfield',
          'uniqueid', 'linkedid', 'sequence',
          'peeraccount'
        ];

        var csv = json2csv({
          data: rows,
          fields: csvFields
        });
        res.setHeader('Content-disposition', 'attachment; filename=cdr.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csv);
      } else {
        res.status(200).send({
          'message': 'Success',
          'data': rows
        });
      }
    } else if (rows.length === 0) {
      return res.status(200).send({
        'message': 'No cdr records',
        'data': rows
      });
    }
  });
});



router.get('/users', restrict, function (req, res) {
  var sql_users = "SELECT u.idlogin_credentials, u.username, u.first_name, u.last_name, g.group_name, u.last_login FROM login_credentials u LEFT JOIN groups g ON u.group_id = g.idgroups;";
  var sql_groups = "SELECT * FROM groups;";
  req.connection.query(sql_users, function (err1, users) {
    if (err1) {
      console.log("SQL Error: " + err1);
    } else {
      req.connection.query(sql_groups, function (err2, groups) {
        if (err2) {
          console.log("SQL Error: " + err2);
        } else {
          res.render('pages/admin/users', {
            users: users,
            groups: groups,
            role: req.session.role
          });
        }
      });
    }
  });
});

router.get('/groups', restrict, function (req, res) {
  var sql = "SELECT idgroups, group_name, description FROM groups;";
  req.connection.query(sql, function (err, results) {
    if (err) {
      console.log("SQL Error: " + err);
    } else {
      res.render('pages/admin/groups', {
        groups: results,
        role: req.session.role
      });
    }
  });
});

router.post('/AddGroup', restrict, function (req, res) {
  var groupname = req.body.groupname;
  var description = req.body.description;

  if (true) {
      var sql = "INSERT INTO groups (group_name, description) VALUES (?,?);";
      req.connection.query(sql, [groupname, description], function (err, result) {
        if (err) {
          console.log('SQL ERR: ' + err);
          res.send('err');
        } else {
          res.send(result.affectedRows + " record updated");
        }
      });
  } else {
    res.send('Bad Inputs')
  }
});

router.post('/DeleteGroup', restrict, function (req, res) {
  var id = req.body.id;
  console.log("Delete ID: " + id)
  if (!isNaN(id)) {
    var sql = "DELETE FROM groups WHERE idgroups = ?;";
    req.connection.query(sql, id, function (err, result) {
      if (err) {
        console.log('SQL ERR: ' + err);
        res.send('err');
      } else {
        res.send(result.affectedRows + " record deleted");
      }
    });
  } else {
    res.send('Bad Inputs')
  }
});


router.get('/servertest', restrict, function (req, res) {
  res.render('pages/admin/server_test', {
    role: req.session.role
  });
});

router.post('/AddUser', restrict, function (req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var firstname = req.body.firstname;
  var lastname = req.body.lastname;
  var group_id = req.body.group_id;

  if (validator.isUsernameValid(username) && validator.isPasswordComplex(password) && validator.isNameValid(firstname) && validator.isNameValid(lastname)) {
    bcrypt.hash(password, 10, function (err, hash) {
      var sql = "INSERT INTO login_credentials (username, password, first_name, last_name, role, last_login, group_id) VALUES (?,?,?,?,?,?,?);";
      req.connection.query(sql, [username, hash, firstname, lastname, "researcher", null, group_id], function (err, result) {
        if (err) {
          console.log('SQL ERR: ' + err);
          res.send('err');
        } else {
          res.send(result.affectedRows + " record updated");
        }
      });
    });
  } else {
    res.send('Bad Inputs')
  }
});

router.post('/DeleteUser', restrict, function (req, res) {
  var id = req.body.id;
  console.log("Delete ID: " + id)
  if (id > 1 && !isNaN(id)) {
    var sql = "DELETE FROM login_credentials WHERE idlogin_credentials = ? AND role <> 'admin';";
    req.connection.query(sql, id, function (err, result) {
      if (err) {
        console.log('SQL ERR: ' + err);
        res.send('err');
      } else {
        res.send(result.affectedRows + " record deleted");
      }
    });
  } else {
    res.send('Bad Inputs')
  }
});


router.get('/research_data', restrict, function (req, res) {
  res.render('pages/admin/research_data', {
    'role': req.session.role
  });
});

router.get('/getResearchData', restrict, function (req, res) {
  var download = req.query.download;
  var start = req.query.start;
  var end = req.query.end;
  var group_id = req.session.group_id;
  if (typeof download === 'undefined' || download != 'true')
    download = false;

  var query = 'SELECT rd.id, rd.call_start, rd.device_id, rd.extension, rd.dest_phone_number, rd.call_duration, rd.stt_engine, rd.scenario_number, rd.added_delay, rd.transcription_file, rd.audio_file, rd.notes, ds.group_id, CASE WHEN rd.video_file IS NULL THEN \'false\' ELSE \'true\' END AS has_video FROM research_data rd LEFT JOIN device_settings ds ON rd.extension = ds.extension WHERE ds.group_id = ?'
  var params = [group_id];
  if ((start && end) && (start != 'undefined' && end != 'undefined')) {
    query += ' AND (call_start BETWEEN ? AND ?)';
    params = [group_id, start, end];
  }

  if(req.session.role == 'admin'){
    query = 'SELECT rd.id, rd.call_start, rd.device_id, rd.extension, rd.dest_phone_number, rd.call_duration, rd.stt_engine, rd.scenario_number, rd.added_delay, rd.transcription_file, rd.audio_file, rd.notes, ds.group_id, CASE WHEN rd.video_file IS NULL THEN \'false\' ELSE \'true\' END AS has_video FROM research_data rd LEFT JOIN device_settings ds ON rd.extension = ds.extension '
    params = [];
    if ((start && end) && (start != 'undefined' && end != 'undefined')) {
      query += ' WHERE (call_start BETWEEN ? AND ?)';
      params = [start, end];
    }
  }

 
  query += ';';

  req.connection.query(query, params, function (err, rows) {
    if (err) {
      console.log("/call_logs ERROR: ", err.code);
      res.send({
        "message": "Failed"
      });
    } else {
      if (download) {
        // Column names for the CSV file.
        var csvFields = ['id', 'call_start', 'device_id', 'extension', 'dest_phone_number', 'call_duration', 'scenario_number', 'stt_engine', 'added_delay', 'transcription_file', 'audio_file', 'transcription_filename', 'audio_filename', 'notes', 'mobizen_notes'];
        var csvData = [];
        var fullUrl = 'https://' + req.get('host'); //req.protocol always return http?

        for (i in rows) {
          var obj = {
            id: rows[i].id,
            call_start: rows[i].call_start,
            device_id: rows[i].device_id,
            extension: rows[i].extension,
            dest_phone_number: rows[i].dest_phone_number,
            call_duration: rows[i].call_duration,
            scenario_number: rows[i].scenario_number,
            stt_engine: rows[i].stt_engine,
            added_delay: rows[i].added_delay,
            transcription_file: '=HYPERLINK("' + fullUrl + '/admin/getTranscripts?download=true&id=' + rows[i].id + '", "text")',
            audio_file: '=HYPERLINK("' + fullUrl + '/admin/getAudioFile?download=true&id=' + rows[i].id + '", "audio")',
            transcription_filename: rows[i].transcription_file,
            audio_filename: rows[i].audio_file,
            notes: rows[i].notes,
            mobizen_notes: rows[i].mobizen_notes
          };
          csvData.push(obj);
        }

        var csv = json2csv({
          data: csvData,
          fields: csvFields
        });
        res.setHeader('Content-disposition', 'attachment; filename=acequill_research_data.csv');
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csv);
      } else {
        if (rows.length > 0) {
          res.status(200).send({
            'records': rows,
            'message': 'Success'
          });
        } else {
          res.status(200).send({
            'records': rows,
            'message': 'No Data'
          });
        }
      }
    }
  });
});


router.get('/getTranscripts', restrict, function (req, res) {
  var id = req.query.id;
  var download = req.query.download;

  if (typeof download === 'undefined' || download != 'true')
    download = false;

  if (typeof id === 'undefined' || isNaN(id))
    id = 0;

  req.connection.query('SELECT transcription_file_path, transcription_file FROM research_data where id = ?;', id, function (err, rows) {
    if (err) {
      console.log("/getTranscripts ERROR: ", err.code);
      res.send("An Error Occurred");
    } else if (rows.length == 1) {
      var txtFile = rows[0].transcription_file_path + '/' + rows[0].transcription_file;
      console.log('TEXT FILE PATH: ' + txtFile);
      if (fs.existsSync(txtFile)) {

        if (download) {
          res.download(txtFile);
        } else {

          var lineReader = require('readline').createInterface({
            input: require('fs').createReadStream(txtFile)
          });
          var transcript = [];
          lineReader.on('line', function (line) {
            var i = line.indexOf(':');
            var splits = [line.slice(0, i), line.slice(i + 1)];
            transcript.push(splits);
          });
          lineReader.on('close', function () {
            res.send(transcript);
          })
        }
      } else {
        res.send();
      }
    } else {
      res.send("no records")
    }
  })
});

router.get('/getAudioFile', restrict, function (req, res) {
  var id = req.query.id;
  if (typeof id === 'undefined' || isNaN(id))
    id = 0;

  req.connection.query('SELECT audio_file_path, audio_file FROM research_data where id = ?;', id, function (err, rows) {
    if (err) {
      console.log("/getAudioFile ERROR: ", err);
      res.send("An Error Occurred");
    } else if (rows.length == 1) {
      var audioFile = rows[0].audio_file_path + '/' + rows[0].audio_file;
      var stat = fs.statSync(audioFile);
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': stat.size
      });
      var readStream = fs.createReadStream(audioFile);
      readStream.pipe(res);
    } else {
      res.send("No results");
    }
  })
});

router.get('/getVideoFile', restrict, function (req, res) {
  var id = req.query.id;
  var videoFilepath = decode(req.configs.get('videoFilePath'));
  if (typeof id === 'undefined' || isNaN(id))
    id = 0;
  console.log('/getVideoFile id:' + id);
  req.connection.query('SELECT video_file FROM research_data where id = ?;', id, function (err, rows) {
    if (err) {
      console.log("/getVideoFile ERROR: ", err.code);
      res.send("An Error Occurred");
    } else if (rows.length == 1) {
      var videoFile = videoFilepath + rows[0].video_file;
      var stat = fs.statSync(videoFile);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size
      });
      var readStream = fs.createReadStream(videoFile);
      readStream.pipe(res);
    } else {
      res.send("No video");
    }
  })
});


router.get('/getNotes', restrict, function (req, res) {
  var id = req.query.id;
  if (typeof id === 'undefined' || isNaN(id))
    id = 0;

  req.connection.query('SELECT notes, mobizen_notes FROM research_data where id = ?;', id, function (err, rows) {
    if (err) {
      console.log("/getNotes ERROR: ", err.code);
      res.send("An Error Occurred");
    } else if (rows.length > 0) {
      var notes = {};
      notes.call = rows[0].notes;
      notes.mobizen = rows[0].mobizen_notes;
      res.send(notes);
    } else {
      res.send(null)
    }
  })
});

router.post('/saveNotes', restrict, function (req, res) {
  var id = req.body.id;
  var callNotes = req.body.callNotes;
  var mobizenNotes = req.body.mobizenNotes;
  var sql = "UPDATE research_data SET notes = ?, mobizen_notes = ? WHERE id = ?;";
  req.connection.query(sql, [callNotes, mobizenNotes, id], function (err, result) {
    res.send(result.affectedRows + " record updated");
  });
});

router.post('/deleteVideo', restrict, function (req, res) {
  var id = req.body.id;
  var sql = "UPDATE research_data SET video_file = NULL WHERE id = ?;";
  req.connection.query(sql, id, function (err, result) {
    res.send(result.affectedRows + " record updated");
  });
});

router.post('/uploadVideo', restrict, function (req, res) {
  console.log('/uploadVideo Called');
  var formidable = require('formidable');
  var form = new formidable.IncomingForm();
  form.uploadDir = __dirname + '/../' + decode(req.configs.get('videoFilePath'));
  form.keepExtensions = true;
  form.maxFieldsSize = 10 * 1024 * 1024;
  form.maxFields = 1000;
  form.multiples = false;

  form.parse(req, function (err, fields, files) {
    if (err) {
      res.writeHead(200, {
        'content-type': 'text/plain'
      });
      res.write('an error occurred');
    } else {
      var id = JSON.parse(fields.id);
      var fullpath = files.file.path
      var filename = fullpath.substring(fullpath.lastIndexOf("/") + 1);

      req.connection.query('UPDATE research_data SET video_file = ? WHERE id = ?;', [filename, id], function (err, rows) {
        if (err) {
          console.log("/uploadVideo MySQL ERROR: ", err.code);
          res.send("An Error Occurred");
        } else {
          console.log(id + ': received upload: ' + filename);
          res.write('received upload: ' + filename);
          res.end();
        }
      })
    }

  });


});

router.get('/configs', restrict, function (req, res) {
  var group_id = req.session.group_id;
  var sql = "SELECT extension, stt_engine, delay, default_device, name FROM device_settings WHERE group_id IN (0, ?);";
  if(req.session.role == 'admin')
    sql = "SELECT d.extension, d.stt_engine, d.delay, d.default_device, d.name, g.group_name FROM device_settings d LEFT JOIN groups g ON d.group_id = g.idgroups ;";
  req.connection.query(sql, group_id, function (err, results) {
    if (err) {
      console.log("SQL Error: " + err);
    } else {
      res.render('pages/admin/configurations', {
        sttConfigs: results,
        role: req.session.role
      });
    }
  });


  router.post('/UpdateConfig', restrict, function (req, res) {
    var extension = parseInt(req.body.extension);
    var name = req.body.name;
    var stt_engine = req.body.stt_engine;
    var delay = req.body.delay;

    var group_id = req.session.group_id;

    if (!extension)
      extension = 0;

    if (stt_engine && delay && name) {
      var sql = "INSERT INTO device_settings (extension, stt_engine, delay, name, group_id) VALUES (?,?,?,?,?) " +
        "ON DUPLICATE KEY UPDATE stt_engine = VALUES(stt_engine), name = VALUES(name), delay = VALUES(delay);";
      req.connection.query(sql, [extension, stt_engine, delay, name, group_id], function (err, result) {
        if (err) {
          console.log('SQL ERR: ' + err);
          res.send('err');
        } else {
          res.send(result.affectedRows + " record updated");
        }
      });
    } else {
      res.send('Bad Inputs')
    }
  });

  router.post('/DeleteConfig', restrict, function (req, res) {
    var extension = req.body.extension;
    console.log("Delete ID: " + extension)
    if (extension) {
      var sql = "DELETE FROM device_settings WHERE extension = ? AND default_device <> true;";
      req.connection.query(sql, extension, function (err, result) {
        if (err) {
          console.log('SQL ERR: ' + err);
          res.send('err');
        } else {
          res.send(result.affectedRows + " record deleted");
        }
      });
    } else {
      res.send('Bad Inputs')
    }
  });



});
router.get('/stt_engines', restrict, function (req, res) {
  res.render('pages/admin/stt_engines', {
    role: req.session.role
  });
});
router.get('/rtstt', restrict, function (req, res) {
  res.render('pages/admin/rtstt', {
    role: req.session.role
  });
});
router.get('/callreview', restrict, function (req, res) {
  res.render('pages/admin/callreview', {
    role: req.session.role
  });
});

router.get('/firsttimesetup', function (req, res) {
  var sql = "SELECT COUNT(*) AS adminCount FROM login_credentials WHERE role = 'admin' limit 0,1;";
  req.connection.query(sql, function (err, result) {
    if (err) {
      console.log('SQL ERR: ' + err);
      res.send('err');
    } else if (result[0].adminCount == 0) {
      res.render('pages/admin/firsttimesetup');
    } else {
      res.redirect('./');
    }
  });
});

router.post('/CreateAdmin', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var firstname = req.body.firstname;
  var lastname = req.body.lastname;
  if (validator.isUsernameValid(username) && validator.isPasswordComplex(password) && validator.isNameValid(firstname) && validator.isNameValid(lastname)) {
    var sql_1 = "SELECT COUNT(*) AS adminCount FROM login_credentials WHERE role = 'admin' limit 0,1;";
    req.connection.query(sql_1, function (err, result_1) {
      if (err) {
        console.log('SQL ERR: ' + err);
        res.send('err');
      } else if (result_1[0].adminCount == 0) {
        bcrypt.hash(password, 10, function (err, hash) {
          var sql_2 = "INSERT INTO login_credentials (username, password, first_name, last_name, role, last_login) VALUES (?,?,?,?,?,?);";
          req.connection.query(sql_2, [username, hash, firstname, lastname, "admin", null], function (err, result_2) {
            if (err) {
              console.log('SQL ERR: ' + err);
              res.send('err');
            } else {
              res.send(result_2.affectedRows + " record updated");
            }
          });
        });
      } else {
        res.send("Account already exists");
      }
    });
  } else {
    res.send('Bad Inputs')
  }
});



router.get('/login', function (req, res) {
  if (req.session.user) {
    res.redirect('./');
  } else {
    res.render('pages/admin/login');
  }
});

router.post('/login', function (req, res) {
  var username = req.body.username;
  var password = req.body.password;
  if (validator.isUsernameValid(username) && validator.isPasswordComplex(password)) {
    var sql = "SELECT u.*, g.group_name FROM login_credentials u LEFT JOIN groups g ON u.group_id = g.idgroups  WHERE username = ? limit 0,1;";
    var params = [username]
    req.connection.query(sql, params, function (err, user) {
      if (err) {
        console.log("SQL Login Error: " + err);
      } else {
        if (user.length == 1) {
          bcrypt.compare(password, user[0].password, function (err, valid) {
            if (valid) {
              req.session.idlogin_credentials = user[0].idlogin_credentials;
              req.session.user = user[0].username;
              req.session.firstname = user[0].first_name;
              req.session.lastname = user[0].last_name;
              req.session.role = user[0].role;
              req.session.group_id = user[0].group_id;
              req.session.group_name = user[0].group_name;
              req.session.error = '';
              req.connection.query("UPDATE `login_credentials` SET `last_login` = now() WHERE `idlogin_credentials` = ?", user[0].idlogin_credentials, function (err, result) {});
              res.status(200).send('success');
            } else {
              res.status(200).send('failure');
            }
          });
        } else {
          res.status(200).send('failure');
        }
      }
    });
  } else {
    res.send('Bad Inputs')
  }
});

router.get('/logout', function (req, res) {
  req.session.destroy(function (err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect('./');
    }
  });
});

router.get('/logout', function (req, res) {
  req.session.destroy(function (err) {
    if (err) {
      console.log(err);
    } else {
      res.redirect('./');
    }
  });
});

module.exports = router;