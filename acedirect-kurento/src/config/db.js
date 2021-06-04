require('dotenv').config();

/*************************************************
 * These config. vars are now in dat/config.json *
 ************************************************/

const base = {
  username: process.env.MYSQL_USERNAME || "username",
  password: process.env.MYSQL_PASSWORD || "password",
  database: process.env.MYSQL_DATABASE || "databasename",
  host:     process.env.MYSQL_DATABASE_HOST || "FQDN",
  dialect:  "mysql"
}

//use dat/config.json for this now
var fs = require('fs');

var nconf = require('nconf');
nconf.argv().env();  // Get the name of the config file from the command line (optional)

var cfile = '../dat/config.json'; 

//Validate the incoming JSON config file
try {
  var content = fs.readFileSync(cfile,'utf8');
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

nconf.file({file: cfile});
var configobj = JSON.parse(fs.readFileSync(cfile,'utf8'));

//the presence of a populated cleartext field in config.json means that the file is in clear text
//remove the field or set it to "" if the file is encoded
var clearText = false;
if (typeof(nconf.get('common:cleartext')) !== "undefined"  && nconf.get('common:cleartext') !== ""  ) {
    console.log('clearText field is in config.json. assuming file is in clear text');
    clearText = true;
}

//get dat/config.json vars
base.username = getConfigVal('database_servers:mysql:user');
base.password = getConfigVal('database_servers:mysql:password');
base.database = getConfigVal('database_servers:mysql:ssdatabase');
base.host = getConfigVal('servers:mysql_fqdn');
base.dialect = "mysql";

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
    console.error('');
    console.error('*******************************************************');
    console.error('ERROR!!! Config parameter is missing: ' + param_name);
    console.error('*******************************************************');
    console.error('');
    decodedString = "";
  }
  return (decodedString.toString());
}

module.exports = {
  "development": base,
  "test": base,
  "production": base
}
