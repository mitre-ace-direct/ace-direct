const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const log4js = require('log4js');
const nconf = require('nconf');
const morgan = require('morgan');
const path = require('path');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const passport = require('passport');
const flash = require('connect-flash');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const favicon = require('serve-favicon');

const app = express();
const cfile = '../dat/config.json';
require('./config/passport')(passport);
const User = require('./app/models/user');

let clearText = false;
let debugLevel = '';

function myCleanup() {
  console.log('\n\n***Exiting***\nbyeee.\n\n');
}
require('./cleanup').Cleanup(myCleanup);

// Initialize log4js
const logname = 'auth_server';
log4js.configure({
  appenders: {
    auth_server: {
      type: 'dateFile',
      filename: `logs/${logname}.log`,
      alwaysIncludePattern: false,
      maxLogSize: 20480,
      backups: 10
    }
  },
  categories: {
    default: {
      appenders: ['auth_server'],
      level: 'error'
    }
  }
});

// Get the name of the config file from the command line (optional)
nconf.argv().env();

// Validate the incoming JSON config file
try {
  const content = fs.readFileSync(cfile, 'utf8');
  JSON.parse(content);
  console.log('Valid JSON config file');
} catch (ex) {
  console.log('\n\n*******************************************************');
  console.log(`Error! Malformed configuration file: ${cfile}`);
  console.log('Exiting...\n*******************************************************\n\n');
  process.exit(1);
}

const logger = log4js.getLogger('auth_server');

nconf.file({
  file: cfile
});

if (typeof (nconf.get('common:cleartext')) !== 'undefined' && nconf.get('common:cleartext') !== '') {
  console.log('clearText field is in config.json. assuming file is in clear text');
  clearText = true;
}

function getConfigVal(paramName) {
  const val = nconf.get(paramName);
  let decodedString = null;
  if (typeof val !== 'undefined' && val !== null) {
    // found value for paramName
    decodedString = null;
    if (clearText) {
      decodedString = val;
    } else {
      decodedString = Buffer.alloc(val.length, val, 'base64');
    }
  } else {
    // did not find value for paramName
    logger.error('\n*******************************************************');
    logger.error(`ERROR!!! Config parameter is missing: ${paramName}`);
    logger.error('*******************************************************\n');
    decodedString = '';
  }
  return (decodedString.toString());
}


// MAIN


// Set log4js level from the config file
debugLevel = getConfigVal('common:debug_level');
logger.level = debugLevel;
logger.trace('TRACE messages enabled.');
logger.debug('DEBUG messages enabled.');
logger.info('INFO messages enabled.');
logger.warn('WARN messages enabled.');
logger.error('ERROR messages enabled.');
logger.fatal('FATAL messages enabled.');
logger.info(`Using config file: ${cfile}`);

if (debugLevel === 'DEBUG') {
  console.log('Express debugging on!');
  app.use(morgan('dev'));
}

// Start the server
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

const credentials = {
  key: fs.readFileSync(getConfigVal('common:https:private_key')),
  cert: fs.readFileSync(getConfigVal('common:https:certificate'))
};

require('./app/routes')(app, passport, User);

const server = https.createServer(credentials, app);

const appServer = server.listen(parseInt(getConfigVal('app_ports:auth-server'), 10));
console.log('auth-server running on port %s   (Ctrl+C to Quit)', parseInt(getConfigVal('app_ports:auth-server'), 10));

module.exports = appServer;
module.exports.myCleanup = myCleanup;
