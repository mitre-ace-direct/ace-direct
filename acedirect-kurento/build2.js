const path = require('path');
const now = new Date()  
const secondsSinceEpoch = Math.round(now.getTime() / 1000)  

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


//function to execute shell command as a promise
//cmd is the shell command
//wdir is the working dir
//return a Promise
function execCommand(cmd,wdir) {
  console.log('executing  ' + cmd + ' ...');
  const exec = require('child_process').exec;
  return new Promise((resolve, reject) => {
    exec(cmd, {cwd: wdir}, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
        process.exit(99); 
      }
      resolve(stdout? stdout : stderr);
    });
  });
}

async function go() {

  s = await execCommand('rm -rf node_modules >/dev/null  # removing node_modules','.');
  s = await execCommand('rm -rf vendor/kurento-client-js/node_modules >/dev/null  # removing node_modules','.');
  s = await execCommand('rm -rf vendor/kurento-jsonrpc/node_modules >/dev/null  # removing node_modules','.');
  s = await execCommand('rm -rf vendor/reconnect-ws/node_modules >/dev/null  # removing node_modules','.');
  s = await execCommand('sleep 5  # pause before npm install... ','.');
  s = await execCommand('which yarn >/dev/null  ','.');

  s = await execCommand('npm install   # main install','.');

  s = await execCommand('cp confs/jssip-modifications/RTCSession.js node_modules/jssip/lib-es5/.', '.');
  s = await execCommand('cp confs/jssip-modifications/UA.js node_modules/jssip/lib-es5/.', '.');

  s = await execCommand('npm run bower  ','.');

  console.log('Make sure yarn is installed: sudo su - root ; npm install -g yarn');
  s = await execCommand('yarn install  ','./vendor/kurento-client-js');
  s = await execCommand('yarn install  ','./vendor/kurento-jsonrpc');
  s = await execCommand('yarn install  ','./vendor/reconnect-ws');

  //generate the confs/kurento/WebRtcEndpoint.conf.ini file...
  stun_svr = "stunServerAddress=" + getConfigVal('asterisk:sip:stun');
  stun_port = "stunServerPort=" + getConfigVal('asterisk:sip:stun_port');
  turn_url = "turnURL=" + getConfigVal('asterisk:sip:turn_user') + ":" + getConfigVal('asterisk:sip:turn_cred') + "@" + getConfigVal('asterisk:sip:turn');
  s = await execCommand('echo ' + stun_svr + ' > WebRtcEndpoint.conf.ini','./confs/kurento');
  s = await execCommand('echo ' + stun_port + ' >> WebRtcEndpoint.conf.ini','./confs/kurento');
  s = await execCommand('echo ' + turn_url + ' >> WebRtcEndpoint.conf.ini','./confs/kurento');

  console.log('');
  console.log('TODO:');
  console.log('npm run dev   # to start, or run with PM2: pm2 start process.json  ');
  console.log('');
}

go(); //MAIN
