module.exports = {
  UploadVideomail: UploadVideomail
}

const config = require('./configuration.js');
const fs = require('fs');
const request = require('request');
const uploadAPI = config.uploadServer + '/UploadVideomail';
const FormData = require('form-data');
const { getVideoDurationInSeconds } = require('get-video-duration');
const AWS = require('aws-sdk');
const proxy = require('proxy-agent');

AWS.config.update({
  region: config.awsRegion,
  httpOptions: {
    agent: proxy(config.proxy)
  }
});

const s3 = new AWS.S3();

function UploadVideomail() {
  this.post = post;
}


function post(callinfo) {
  console.log("Attempting to Post Videomail recording", callinfo.recordingFile, callinfo.incomingCaller)
  let fileRequest = config.kmsMediaPathURL + callinfo.recordingFile;
  const filepath = 'media/' + callinfo.recordingFile
  let vm = fs.createWriteStream(filepath);
  request(fileRequest).pipe(vm);

  vm.on('finish', function () {
    fs.stat(filepath, function (err, stat) {
      if (err) {
        if (err.code === 'ENOENT') {
          console.log("No Videomail File for call:", new Date(), callinfo.incomingCaller, callinfo.recordingFile);
        } else {
          console.log('Error when trying to upload file: ', err.code);
        }
      } else if (stat && stat.size == 0) {
        console.log('Error Videomail file contains no data: ', new Date(), callinfo.incomingCaller, callinfo.recordingFile);
      } else {
        let videomailFile = fs.createReadStream(filepath);
        videomailFile.on('data', (chunk) => {
          // just to be sure file has reached the end.
        });

        videomailFile.on('end', function () {
          console.log("file has ended, upload the file", callinfo.incomingCaller)
          getVideoDurationInSeconds(filepath).then((duration) => {
            try {
              fs.unlinkSync(filepath)
            } catch (err) {
              console.error(err)
            }
            fs.readFile(filepath, function (err, fileData) {
              var uploadParams = { Bucket: 'task3acrdemo-recordings', Key: callinfo.recordingFile, Body: "" };
              uploadParams.Body = fileData;
              s3.upload(uploadParams, function (err, data) {
                if (err) {
                  console.log("Error", err);
                  return
                }
                let formData = new FormData();
                formData.append('duration', Math.floor(duration));
                formData.append('ext', callinfo.ext);
                formData.append('phoneNumber', callinfo.incomingCaller);
                formData.append('filename', callinfo.recordingFile);

                request({
                  method: 'POST',
                  url: uploadAPI,
                  rejectUnauthorized: false,
                  body: formData,
                  headers: formData.getHeaders(),
                }, function (error, response, data) {
                  if (error) {
                    console.log("Error", error);
                    console.log("Could not upload:", new Date(), callinfo.incomingCaller, callinfo.recordingFile);
                  } else {
                    console.log("Successful video upload:", new Date(), callinfo.incomingCaller, callinfo.recordingFile);
                  }
                });
              });
            });
          });
        });
      }
    });
  });
}
