const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const clear = require('clear');
const mysql = require('mysql');
const AsteriskManager = require('asterisk-manager');
const log4js = require('log4js');
const nconf = require('nconf');
const morgan = require('morgan');
const path = require('path');

const app = express();
const cfile = '../dat/config.json';

let connection = null;
let connection2 = null; // asterisk database
let clearText = false;
let debugLevel = '';

// CLEAN UP function; must be at the top!
// for exits, abnormal ends, signals, uncaught exceptions
function myCleanup() {
  // clean up code on exit, exception, SIGINT, etc.
  console.log('');
  console.log('***Exiting***');

  // DB cleanup

  // clean up AD database connection
  if (connection) {
    console.log('Cleaning up DB connection...');
    connection.destroy();
  }

  // clean up Asterisk database connection
  if (connection2) {
    console.log('Cleaning up DB connection2 (Asterisk database)...');
    connection2.destroy();
  }

  console.log('byeee.');
  console.log('');
}
require('./cleanup').Cleanup(myCleanup);

// Initialize log4js
const logname = 'mserver';
log4js.configure({
  appenders: {
    mserver: {
      type: 'dateFile',
      filename: `logs/${logname}.log`,
      alwaysIncludePattern: false,
      maxLogSize: 20480,
      backups: 10
    }
  },
  categories: {
    default: {
      appenders: ['mserver'],
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
  console.log('');
  console.log('*******************************************************');
  console.log(`Error! Malformed configuration file: ${cfile}`);
  console.log('Exiting...');
  console.log('*******************************************************');
  console.log('');
  process.exit(1);
}

const logger = log4js.getLogger('mserver');

nconf.file({
  file: cfile
});

// the presence of a populated cleartext field in config.json means that the file is in clear text
// remove the field or set it to "" if the file is encoded
if (typeof (nconf.get('common:cleartext')) !== 'undefined' && nconf.get('common:cleartext') !== '') {
  console.log('clearText field is in config.json. assuming file is in clear text');
  clearText = true;
}

/**
 * Function to verify the config parameter name and
 * decode it from Base64 (if necessary).
 * @param {type} paramName of the config parameter
 * @returns {unresolved} Decoded readable string.
 */
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
    logger.error('');
    logger.error('*******************************************************');
    logger.error(`ERROR!!! Config parameter is missing: ${paramName}`);
    logger.error('*******************************************************');
    logger.error('');
    decodedString = '';
  }
  return (decodedString.toString());
}

const cdrTable = getConfigVal('database_servers:mysql:cdr_table_name');

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

clear(); // clear console

// Create MySQL connection (ACE Direct database) and connect to it
connection = mysql.createConnection({
  host: getConfigVal('servers:mysql_fqdn'),
  user: getConfigVal('database_servers:mysql:user'),
  password: getConfigVal('database_servers:mysql:password'),
  database: getConfigVal('database_servers:mysql:ad_database_name')
});
connection.connect();
// Keeps connection from Inactivity Timeout
setInterval(() => {
  connection.ping();
}, 60000);

// Create MySQL connection2 (Asterisk database) and connect to it
connection2 = mysql.createConnection({
  host: getConfigVal('servers:mysql_fqdn'),
  user: getConfigVal('database_servers:mysql:user'),
  password: getConfigVal('database_servers:mysql:password'),
  database: getConfigVal('database_servers:mysql:cdr_database_name')
});
connection2.connect();
// Keeps connection2 from Inactivity Timeout
setInterval(() => {
  connection2.ping();
}, 59000);

const asterisk = new AsteriskManager(getConfigVal('app_ports:asterisk_ami').toString(),
  getConfigVal('servers:asterisk_private_ip'),
  getConfigVal('asterisk:ami:id'),
  getConfigVal('asterisk:ami:passwd'), true);
asterisk.keepConnected();

let itrsMode = getConfigVal('user_service:itrs_mode');
if (itrsMode.length === 0) {
  logger.error('error - user_service:itrs_mode param is missing; defaulting to false');
  itrsMode = 'false';
}

// Start the server
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

const staticFilePath = path.join(__dirname, '/apidoc');
app.use(express.static(staticFilePath));

app.use(bodyParser.json({ type: 'application/vnd/api+json' }));

app.use('/', require('./routes/aserver.js')(connection, asterisk));
app.use('/', require('./routes/userver.js')(connection, itrsMode));
app.use('/', require('./routes/cdr.js')(connection2, logger, cdrTable));

const credentials = {
  key: fs.readFileSync(getConfigVal('common:https:private_key')),
  cert: fs.readFileSync(getConfigVal('common:https:certificate'))
};
const server = https.createServer(credentials, app);

const appServer = server.listen(parseInt(getConfigVal('app_ports:mserver'), 10));
console.log('https web server for agent portal up and running on port %s   (Ctrl+C to Quit)', parseInt(getConfigVal('app_ports:mserver'), 10));

module.exports = appServer;
module.exports.myCleanup = myCleanup;
