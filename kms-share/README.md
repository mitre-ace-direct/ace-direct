# KMS Share

This is a Node.js servlet that runs on the Kurento Media Server. The purpose of this servlet is to provide access to the videomail and screen recording files.

## Getting Started

To install KMS Share

1. Clone this repository onto the kurento media server
1. Download and install Node.js
1. Install the required Node.js modules: run `npm install`

To start the KMS Share Servlet manually, run `npm start` or if using pm2 `pm2 start process.json`

## Configuration

The KMS Share servlet requires no additional configuration. By default the servlet will run on port 3000. To change the default port run `export PORT=<port>` then restart the kms share servlet.
