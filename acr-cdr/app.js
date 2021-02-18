// This is the main JS for the ACR-CDR RESTFul server
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var mysql = require('mysql');
var clear = require('clear');
var fs = require('fs');
var nconf = require('nconf');
var log4js = require('log4js');
var https = require('https');
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
var logname = 'acr-cdr';
log4js.configure({
  appenders: {
    acr_cdr: {
      type: 'dateFile',
      filename: 'logs/' + logname + '.log',
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
})
var logger = log4js.getLogger('acr_cdr');

// Read this config file from the local directory
cfile = '../dat/config.json';



// Verify that the config.json file is properly formatted
var fs = require('fs');
var ex;
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



// Read the params from the config file
nconf.file({file: cfile});

//the presence of a populated cleartext field in config.json means that the file is in clear text
//remove the field or set it to "" if the file is encoded
var clearText = false;
if (typeof(nconf.get('common:cleartext')) !== "undefined"  && nconf.get('common:cleartext') !== ""   ) {
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
logger.info('Using config file: ' + cfile);


var listenPort	= parseInt(getConfigVal('acr_cdr:https_listen_port'));
var dbHost		= getConfigVal('database_servers:mysql:host');
var dbUser		= getConfigVal('database_servers:mysql:user');
var dbPassword	= getConfigVal('database_servers:mysql:password');
var dbName		= getConfigVal('database_servers:mysql:cdr_database_name');
var dbPort		= parseInt(getConfigVal('database_servers:mysql:port'));
var cdrTable	= getConfigVal('database_servers:mysql:cdr_table_name');

clear(); // clear console

// Create MySQL connection and connect to the database
connection = mysql.createConnection({
	host	: dbHost,
	user	: dbUser,
	password: dbPassword,
	database: dbName,
	port	: dbPort
});

connection.connect();

// Keeps connection from Inactivity Timeout
setInterval(function () {
        connection.ping();
}, 60000);

var credentials = {
	key		: fs.readFileSync(getConfigVal('common:https:private_key')),
	cert	: fs.readFileSync(getConfigVal('common:https:certificate'))
};

// Start the server
app.use(express.static(__dirname + '/apidoc'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

var routes = require('./routes/routes.js')(app, connection, logger, cdrTable);
var httpsServer = https.createServer(credentials, app);
httpsServer.listen(parseInt(getConfigVal('acr_cdr:https_listen_port')));
console.log('CDR listening on port=%s ...   (Ctrl+C to Quit)', parseInt(getConfigVal('acr_cdr:https_listen_port')));

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
