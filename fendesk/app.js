// This is the main JS for the fendesk RESTFul server
const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const log4js = require('log4js');
const nconf = require('nconf');
const ip = require('ip');
const path = require('path');

const app = express();
const cfile = '../dat/config.json';
let clearText = false;

// Initialize log4js
const logname = 'fendesk';
log4js.configure({
  appenders: {
    fendesk: {
      type: 'dateFile',
      filename: `logs/${logname}.log`,
      alwaysIncludePattern: false,
      maxLogSize: 20480,
      backups: 10
    }
  },
  categories: {
    default: {
      appenders: ['fendesk'],
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
} catch (ex) {
  console.log('');
  console.log('*******************************************************');
  console.log(`Error! Malformed configuration file: ${cfile}`);
  console.log('Exiting...');
  console.log('*******************************************************');
  console.log('');
  process.exit(1);
}

const logger = log4js.getLogger('fendesk');

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

// Set log4js level from the config file
logger.level = getConfigVal('common:debug_level');
logger.trace('TRACE messages enabled.');
logger.debug('DEBUG messages enabled.');
logger.info('INFO messages enabled.');
logger.warn('WARN messages enabled.');
logger.error('ERROR messages enabled.');
logger.fatal('FATAL messages enabled.');
logger.info(`Using config file: ${cfile}`);

const credentials = {
  key: fs.readFileSync(getConfigVal('common:https:private_key')),
  cert: fs.readFileSync(getConfigVal('common:https:certificate'))
};

// Start the server
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const staticFilePath = path.join(__dirname, '/apidoc');
app.use(express.static(staticFilePath));

app.use(bodyParser.json({ type: 'application/vnd/api+json' }));

require('./routes/routes.js')(app, fs, ip, getConfigVal('app_ports:zendesk'), logger);

const httpsServer = https.createServer(credentials, app);
const appServer = httpsServer.listen(parseInt(getConfigVal('app_ports:zendesk'), 10));
logger.debug('HTTPS Fendesk server running on port=%s   (Ctrl+C to Quit)', parseInt(getConfigVal('app_ports:zendesk'), 10));

// Handle Ctrl-C (graceful shutdown)
process.on('SIGINT', () => {
  logger.debug('Exiting...');
  process.exit(0);
});

module.exports = appServer;
