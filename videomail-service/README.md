Videomail Service
===================================

This is a Node.js servlet that interfaces with the Kurento Media Server to record videomails.  Currently, it is configured to receive calls from Asterisk, record them to a file, then upload the files to an S3 bucket.

### Getting Started
To install videomail service:
1. Clone this repository onto the node server
1. Download and install [Node.js](https://nodejs.org/en/)
1. Install the required Node.js modules:  run `npm install`
1. To start the Videomail Service manually, run `npm start` or if using pm2 `pm2 start process.json`



