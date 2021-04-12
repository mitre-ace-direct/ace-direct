const debug    = require('debug')('ace:rec-man');
const param    = require('param');
const Events   = require('events');
const models   = require('./dal/models');
const S3Client = require('./s3_client');
/**
 * Custom logic for screen recording
 */
const AWS = require('aws-sdk');

var proxy = require('proxy-agent');
AWS.config.update({
  region: 'us-east-1',
  httpOptions: {
    agent: proxy("http://10.202.1.215:3128")
  }
});
var s3 = new AWS.S3();

//AWS.config.update({region : 'us-east-1'});
//s3 = new AWS.S3({apiVersion: '2006-03-01'});

class RecordingManager extends Events {

  static async createRecording(filename, peer, session_id) {
    const id = await models.PeerRecording.create({
      filename,
      peer,
      session_id
    });
    //debug('Created recording for %s: %s', peer, id);
    //Custom logic to try uploading the recording to the s3 bucket
    var uploadParams = {Bucket: 'task3acrdemo-recordings', Key: "rec_33003_20210319_211313.mp4", Body: ""};
    // Configure the file stream and obtain the upload parameters
/*    var fs = require('fs');
    var fileStream = fs.createReadStream("http://172.21.1.155/MikeTest2.txt");
    fileStream.on('error', function(err) {
      console.log('File Error', err);
    });
    uploadParams.Body = fileStream;
    //var path = require('path');
    //uploadParams.Key = path.basename(file);
*/
    var request = require('request');
    /*request.get('http://172.21.1.155:3000/rec_33003_20210319_211313.mp4', function(err, res, body){
    console.log("Running s3 upload");
    uploadParams.Body = body;
    // call S3 to retrieve upload file to specified bucket
    s3.upload (uploadParams, function (err, data) {
      if (err) {
        console.log("Error", err);
      } if (data) {
        console.log("Upload Success", data.Location);
      }
    });
  })*/
  }

  static async upload(filename){
    var uploadParams = {Bucket: 'task3acrdemo-recordings', Key: filename, Body: ""};
    var request = require('request');
    request.get('http://172.21.1.155:3000/'+filename, function(err, res, body){
    console.log("Running s3 upload");
    uploadParams.Body = body;
    // call S3 to retrieve upload file to specified bucket
    s3.upload (uploadParams, function (err, data) {
      if (err) {
        console.log("Error", err);
      } if (data) {
        console.log("Upload Success", data.Location);
	var params = { 
  		Bucket: 'task3acrdemo-recordings'
		}

	s3.listObjects(params, function (err, data) {
  		if(err)throw err;
  		
		console.log(data);
	});
      }
    });
    })
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
