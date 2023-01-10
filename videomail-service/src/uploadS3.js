module.exports = {
  UploadVideomail: UploadVideomail
}

const config = require('./configuration.js');
const fs = require('fs');
const request = require('request');
const uploadAPI = config.uploadServer + '/UploadVideomail';
const { getVideoDurationInSeconds } = require('get-video-duration');
const AWS = require('aws-sdk');
const proxy = require('proxy-agent');
const execSync = require('child_process').execSync;

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
  const filepath = 'media/videomails/' + callinfo.recordingFile
  let vm = fs.createWriteStream(filepath);
  request(fileRequest, (error, response, data) => {
    if (error) {
      console.error("\n\n ****  ERROR ACCESSING kms-share on Kurento!! Is it running?  ****\n");
      console.error(`path: ${fileRequest} `);
      console.error(`${error}\n`);
      console.error(" **********************************\n");
    }
  }
  ).pipe(vm);

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
        try {
          fs.unlinkSync(filepath)
        } catch (err) {
          console.error(err)
        }
        return
      } else {
        let videomailFile = fs.createReadStream(filepath);
        videomailFile.on('data', (chunk) => {
          // just to be sure file has reached the end.
        });

        videomailFile.on('end', function () {
          console.log("file has ended, upload the file", callinfo.incomingCaller)
          fs.readFile(filepath, function (err, fileData) {
            let mimeType = execSync('file --mime-type -b "' + filepath + '"').toString().trim();
            if (mimeType === 'video/mp4') {
              getVideoDurationInSeconds(filepath).then((duration) => {
                var uploadParams = { Bucket: config.awsS3Bucket, Key: callinfo.recordingFile, Body: "" };
                console.log("uploadParams", JSON.stringify(uploadParams))
                uploadParams.Body = fileData;
                s3.upload(uploadParams, function (err) {
                  if (err) {
                    console.log("Error!:", err);
                    return
                  }
                  try {
                    fs.unlinkSync(filepath)
                  } catch (err) {
                    console.error(err)
                  }


                  request({
                    method: 'POST',
                    url: uploadAPI,
                    rejectUnauthorized: false,
                    form: {
                      ext: callinfo.ext,
                      duration: Math.floor(duration),
                      phoneNumber: callinfo.incomingCaller,
                      filename: callinfo.recordingFile
                    },
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
            } else {
              console.log("File is not a video.")
              return;
            }
          });
        });
      }
    });
  });
}
