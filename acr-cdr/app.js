// This is the main JS for the ACR-CDR RESTFul server
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const clear = require('clear');
const fs = require('fs');
const nconf = require('nconf');
const log4js = require('log4js');
const https = require('https');
const path = require('path');

const app = express();
const LOGNAME = 'logs/acr-cdr.log';
const logger = log4js.getLogger('acr_cdr');

// Read this config file from the local directory
const cfile = '../dat/config.json';

let connection = null;
let clearText = false;

/**
 * Function to verify the config parameter name and
 * decode it from Base64 (if necessary).
 * @param {type} paramName of the config parameter
 * @returns {unresolved} Decoded readable string.
 */
function getConfigVal(paramName) {
  let decodedString = null;
  const val = nconf.get(paramName);
  if (typeof val !== 'undefined' && val !== null) {
    // found value for paramName
    if (clearText) {
      decodedString = val;
    } else {
      decodedString = Buffer.alloc(val.length, val, 'base64');
    }
  } else {
    // did not find value for paramName
    logger.error('');
    logger.error('*******************************************************');
    logger.error(`ERROR!!! Config parameter is missing: ${paramName}`);
    logger.error('*******************************************************');
    logger.error('');
    decodedString = '';
  }
  return (decodedString.toString());
}

/* CLEAN UP function; must be at the top! */
/* for exits, abnormal ends, signals, uncaught exceptions */
function myCleanup() {
  /* clean up code on exit, exception, SIGINT, etc. */
  console.log('');
  console.log('***Exiting***');

  /* DB cleanup */
  if (connection) {
    console.log('Cleaning up DB connection...');
    connection.destroy();
  }

  console.log('byeee.');
  console.log('');
}
require('./cleanup').Cleanup(myCleanup);

// Initialize log4js
log4js.configure({
  appenders: {
    acr_cdr: {
      type: 'dateFile',
      filename: `${LOGNAME}`,
      alwaysIncludePattern: false,
      maxLogSize: 20480,
      backups: 10
    }
  },
  categories: {
    default: {
      appenders: ['acr_cdr'],
      level: 'error'
    }
  }
});

// Verify that the config.json file is properly formatted
try {
  const content = fs.readFileSync(cfile, 'utf8');
  JSON.parse(content);
  console.log('Valid JSON config file');
} catch (ex) {
  console.log('');
  console.log('*******************************************************');
  console.log(`Error! Malformed configuration file: ${cfile}`);
  console.log('Exiting...');
  console.log('*******************************************************');
  console.log('');
  process.exit(1);
}

// Read the params from the config file
nconf.file({ file: cfile });

/* the presence of a populated cleartext field in config.json means the file is in clear text */
/* remove the field or set it to '' if the file is encoded */
if (typeof (nconf.get('common:cleartext')) !== 'undefined' && nconf.get('common:cleartext') !== '') {
  console.log('clearText field is in config.json. assuming file is in clear text');
  clearText = true;
}

// Set log4js level from the config file
logger.level = getConfigVal('common:debug_level');
logger.trace('TRACE messages enabled.');
logger.debug('DEBUG messages enabled.');
logger.info('INFO messages enabled.');
logger.warn('WARN messages enabled.');
logger.error('ERROR messages enabled.');
logger.fatal('FATAL messages enabled.');
logger.info(`Using config file:  ${cfile}`);

const listenPort = parseInt(getConfigVal('acr_cdr:https_listen_port'), 10);
const dbHost = getConfigVal('servers:mysql:fqdn');
const dbUser = getConfigVal('database_servers:mysql:user');
const dbPassword = getConfigVal('database_servers:mysql:password');
const dbName = getConfigVal('database_servers:mysql:cdr_database_name');
const dbPort = parseInt(getConfigVal('database_servers:mysql:port'), 10);
const cdrTable = getConfigVal('database_servers:mysql:cdr_table_name');

clear(); // clear console

// Create MySQL connection and connect to the database
connection = mysql.createConnection({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  port: dbPort
});

connection.connect();

// Keeps connection from Inactivity Timeout
setInterval(() => {
  connection.ping();
}, 60000);

const credentials = {
  key: fs.readFileSync(getConfigVal('common:https:private_key')),
  cert: fs.readFileSync(getConfigVal('common:https:certificate'))
};

// Start the server
const staticFilePath = path.join(__dirname, '/apidoc');
app.use(express.static(staticFilePath));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

require('./routes/routes.js')(app, connection, logger, cdrTable);

const httpsServer = https.createServer(credentials, app);
const appServer = httpsServer.listen(listenPort);
console.log('CDR listening on port=%s ...   (Ctrl+C to Quit)', listenPort);

module.exports = appServer;
module.exports.myCleanup = myCleanup;
