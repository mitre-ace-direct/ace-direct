// This is the main JS for the USERVER RESTFul server
var https = require('https');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var fs = require('fs');
var mysql = require('mysql');
var asteriskManager = require('asterisk-manager');
var clear = require('clear');
var log4js = require('log4js');
var nconf = require('nconf');
var morgan = require('morgan');
var cfile = null;
var connection = null;

//CLEAN UP function; must be at the top!
//for exits, abnormal ends, signals, uncaught exceptions
var cleanup = require('./cleanup').Cleanup(myCleanup);
function myCleanup() {
  //clean up code on exit, exception, SIGINT, etc.
  console.log('');
  console.log('***Exiting***');

  //DB cleanup
  if (connection) {
    console.log('Cleaning up DB connection...');
    connection.destroy();
  }

  console.log('byeee.');
  console.log('');
};

// Initialize log4js
var logname = 'aserver';
log4js.configure({
    appenders: {
      aserver: {
        type: 'dateFile',
        filename: 'logs/' + logname + '.log',
        alwaysIncludePattern: false,
        maxLogSize: 20480,
        backups: 10
      }
    },
    categories: {
      default: {
        appenders: ['aserver'],
        level: 'error'
      }
    }
  })

// Get the name of the config file from the command line (optional)
nconf.argv().env();

cfile = '../dat/config.json';

//Validate the incoming JSON config file
try {
    var content = fs.readFileSync(cfile, 'utf8');
    var myjson = JSON.parse(content);
    console.log("Valid JSON config file");
} catch (ex) {
    console.log("");
    console.log("*******************************************************");
    console.log("Error! Malformed configuration file: " + cfile);
    console.log('Exiting...');
    console.log("*******************************************************");
    console.log("");
    process.exit(1);
}

var logger = log4js.getLogger('aserver');

nconf.file({
    file: cfile
});
var configobj = JSON.parse(fs.readFileSync(cfile, 'utf8'));

//the presence of a populated cleartext field in config.json means that the file is in clear text
//remove the field or set it to "" if the file is encoded
var clearText = false;
if (typeof (nconf.get('common:cleartext')) !== "undefined"   && nconf.get('common:cleartext') !== ""  ) {
    console.log('clearText field is in config.json. assuming file is in clear text');
    clearText = true;
}

// Set log4js level from the config file
var debug_level = getConfigVal('common:debug_level');
logger.level = debug_level;
logger.trace('TRACE messages enabled.');
logger.debug('DEBUG messages enabled.');
logger.info('INFO messages enabled.');
logger.warn('WARN messages enabled.');
logger.error('ERROR messages enabled.');
logger.fatal('FATAL messages enabled.');
logger.info('Using config file: ' + cfile);

if (debug_level === "DEBUG") {
    console.log("Express debugging on!");
    app.use(morgan('dev'));
}

// process arguments - user supplied port number?
/* var PORT;
var myArgs = process.argv.slice(2);
if (myArgs.length >= 1) {
  PORT = myArgs[0];
}
PORT = PORT || 8085;

clear(); // clear console
*/

// Create MySQL connection and connect to it
connection = mysql.createConnection({
    host: getConfigVal('database_servers:mysql:host'),
    user: getConfigVal('database_servers:mysql:user'),
    password: getConfigVal('database_servers:mysql:password'),
    database: getConfigVal('database_servers:mysql:ad_database_name')
});
connection.connect();
// Keeps connection from Inactivity Timeout
setInterval(function () {
    connection.ping();
}, 60000);

asterisk = new asteriskManager(parseInt(getConfigVal('asterisk:ami:port')),
getConfigVal('asterisk:sip:private_ip'),
getConfigVal('asterisk:ami:id'),
getConfigVal('asterisk:ami:passwd'), true);
asterisk.keepConnected();

// Start the server
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static(__dirname + '/apidoc'));
/*app.use(bodyParser.json({
    type: 'application/vnd/api+json'
}));
*/
var routes = require('./routes/routes.js')(app, connection, asterisk);
var credentials = {
  key: fs.readFileSync(getConfigVal('common:https:private_key')),
  cert: fs.readFileSync(getConfigVal('common:https:certificate'))
};
var server = https.createServer(credentials, app);

server.listen(parseInt(getConfigVal('agent_service:port')));
console.log('https web server for agent portal up and running on port %s   (Ctrl+C to Quit)', parseInt(getConfigVal('agent_service:port')));

/**
 * Function to verify the config parameter name and
 * decode it from Base64 (if necessary).
 * @param {type} param_name of the config parameter
 * @returns {unresolved} Decoded readable string.
 */
function getConfigVal(param_name) {
  var val = nconf.get(param_name);
  if (typeof val !== 'undefined' && val !== null) {
    //found value for param_name
    var decodedString = null;
    if (clearText) {
      decodedString = val;
    } else {
      decodedString = new Buffer(val, 'base64');
    }
  } else {
    //did not find value for param_name
    logger.error('');
    logger.error('*******************************************************');
    logger.error('ERROR!!! Config parameter is missing: ' + param_name);
    logger.error('*******************************************************');
    logger.error('');
    decodedString = "";
  }
  return (decodedString.toString());
}
