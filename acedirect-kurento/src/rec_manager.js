const debug = require('debug')('ace:rec-man');
const param = require('param');
const Events = require('events');
const models = require('./dal/models');
const S3Client = require('./s3_client');
const proxy = require('proxy-agent');
const fs = require('fs');
const request = require('request');
const { getVideoDurationInSeconds } = require('get-video-duration');
const mysql = require('mysql2');

/**
 * Custom logic for screen recording
 */
const AWS = require('aws-sdk');

AWS.config.update({
  region: param('s3.region'),
  httpOptions: {
    agent: proxy(param('common.proxy'))
  }
});
const s3 = new AWS.S3();

/**
 * Custom logic for mysql connection
 */

const dbHost = param('servers.mysql_fqdn');
const dbUser = param('database_servers.mysql.user');
const dbPassword = param('database_servers.mysql.password');
const dbName = param('database_servers.mysql.ad_database_name');
const dbPort = parseInt(param('app_ports.mysql'));
console.log(`Using host: ${dbHost}`);
console.log(`Using username: ${dbUser}`);
console.log(`Using name: ${dbName}`);
console.log(`Using port: ${dbPort}`);

class RecordingManager extends Events {
  static async createRecording(filename, peer, session_id, agentNumber, otherCallers) {
    const id = await models.PeerRecording.create({
      filename,
      peer,
      session_id
    });
    // debug('Created recording for %s: %s', peer, id);
    // Custom logic to try uploading the recording to the s3 bucket
    const uploadParams = { Bucket: param('s3.bucketname'), Key: filename, Body: '' };

    const fileRequest = `http://${param('servers.kurento_private_ip')}:${param('app_ports.kmsshare')}/recordings/${filename}`;
    const filepath = `media/${filename}`;
    const record = fs.createWriteStream(filepath);
    request(fileRequest, (error, response, data) => {
      if (error) {
        console.error("\n\n ****  ERROR ACCESSING kms-share on Kurento!! Is it running?  ****\n");
        console.error(`path: ${fileRequest} `);
        console.error(`${error}\n`);
        console.error(" **********************************\n");
      }
    }).pipe(record);
    record.on('finish', () => {
      fs.readFile(filepath, (err, fileData) => {
        uploadParams.Body = fileData;
        getVideoDurationInSeconds(filepath).then((duration) => {
          const con = mysql.createConnection(
            {
              host: dbHost,
              user: dbUser,
              password: dbPassword,
              database: dbName,
              port: dbPort
            }
          );
          const sqlQuery = 'INSERT INTO call_recordings (fileName, agentNumber, participants, timestamp, status, duration, deleted) VALUES (?,?,?,NOW(),?,?,?);';
          const params = [filename, agentNumber, otherCallers, 'UNREAD', Math.floor(duration), 0];
          con.promise().query(sqlQuery, params)
            .catch(console.log)
            .then(() => con.end());
        });
        // call S3 to retrieve upload file to specified bucket
        s3.upload(uploadParams, (err, data) => {
          if (err) {
            console.log('Error', err);
          } if (data) {
            console.log('Upload Success', data.Location);
            // Delete file from media folder
          }
        });
      });
    });
  }

  static async listRecordings({
    peer = null, session_id = null, date_interval = null, start = 0
  }) {
    const where = {};
    if (peer) where.peer = peer;
    if (session_id) where.session_id = session_id;
    if (date_interval) {
      const { from, to } = date_interval;
      if (from && to) where.created_at = { $between: [from, to] };
      else if (from) where.created_at = { $gt: from };
      else if (to) where.created_at = { $lt: to };
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
