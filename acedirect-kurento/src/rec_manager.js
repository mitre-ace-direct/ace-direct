const debug    = require('debug')('ace:rec-man');
const param    = require('param');
const Events   = require('events');
const models   = require('./dal/models');
const S3Client = require('./s3_client');
var proxy = require('proxy-agent');
var fs = require('fs');
const request = require('request');
const { getVideoDurationInSeconds } = require('get-video-duration');
var mysql = require('mysql2');

/**
 * Custom logic for screen recording
 */
const AWS = require('aws-sdk');

AWS.config.update({
  region: 'us-east-1',
  httpOptions: {
    agent: proxy(param('awsACE.recording_proxy'))
  }
});
var s3 = new AWS.S3();

/**
 * Custom logic for mysql connection
 */

var dbHost = param('database_servers.mysql.host');
var dbUser = param('database_servers.mysql.user');
var dbPassword = param('database_servers.mysql.password');
var dbName = param('database_servers.mysql.ad_database_name');
var dbPort = parseInt(param('database_servers.mysql.port'));
console.log("Using host: " + dbHost);
console.log("Using username: " + dbUser);
console.log("Using name: " + dbName);
console.log("Using port: " + dbPort);

//AWS.config.update({region : 'us-east-1'});
//s3 = new AWS.S3({apiVersion: '2006-03-01'});

class RecordingManager extends Events {

  static async createRecording(filename, peer, session_id, agentNumber, otherCallers) {
    const id = await models.PeerRecording.create({
      filename,
      peer,
      session_id
    });
    //debug('Created recording for %s: %s', peer, id);
    //Custom logic to try uploading the recording to the s3 bucket
    var uploadParams = {Bucket: param('awsACE.recording_bucket'), Key: filename, Body: ""};

    let fileRequest = param('awsACE.uploadURL') + filename;
    const filepath = 'media/' + filename;
    let record = fs.createWriteStream(filepath);
    request(fileRequest).pipe(record);
    record.on('finish', function () {
      fs.readFile(filepath, function(err, fileData){
        uploadParams.Body = fileData;
        getVideoDurationInSeconds(filepath).then((duration) => {

          const con = mysql.createConnection(
            {
              host: dbHost,
              user: dbUser,
              password: dbPassword,
              database: dbName,
              port: dbPort}
          );
          let sqlQuery = 'INSERT INTO call_recordings (fileName, agentNumber, participants, timestamp, status, duration, deleted) VALUES (?,?,?,NOW(),?,?,?);';
          let params = [filename, agentNumber, otherCallers, 'UNREAD', Math.floor(duration), 0];
          console.log("QUERY is " + sqlQuery);
          con.promise().query(sqlQuery, params)
            .catch(console.log)
            .then( () => con.end());

          /*const dbConnection = await mysql.createConnection({
            host: dbHost,
            user: dbUser,
            password: dbPassword,
            database: dbName,
            port: dbPort
          });
          let sqlQuery = 'INSERT INTO call_recordings (fileName, agentNumber, participants, timestamp, status, duration, deleted) VALUES (?,?,?,NOW(),?);';
          let params = [filename, agentNumber, otherCallers, 'UNREAD', Math.floor(duration), 0];
          console.log("QUERY is " + sqlQuery);

          //var [rows,fields] = await dbConnection.execute(sqlQuery, params);
          var promise = dbConnection.execute(sqlQuery, params);

          await dbConnection.end();*/
        })
        // call S3 to retrieve upload file to specified bucket
        s3.upload (uploadParams, function (err, data) {
          if (err) {
            console.log("Error", err);
          } if (data) {
            console.log("Upload Success", data.Location);
            //Delete file from media folder
          }
        });
      });
    });
}

  static async listRecordings({ peer = null, session_id = null, date_interval = null, start = 0 }) {
    const where = {};
    if(peer) where.peer = peer;
    if(session_id) where.session_id = session_id;
    if(date_interval) {
      const { from, to } = date_interval;
      if(from && to) where.created_at = { $between: [from, to]}
      else if(from) where.created_at = { $gt: from };
      else if(to) where.created_at = { $lt: to };
    }
    const recordings = await models.PeerRecording.findAll({
      where 
    });

    const s3 = new S3Client();

    return await Promise.all(recordings.map(async (rec) => {
      const { filename, ...rest } = rec.dataValues;
      const url = await s3.getSignedUrl('getObject', filename, { Expires: 600 });
      return { ...rest, url };
    }));
  }
}

module.exports = RecordingManager;
