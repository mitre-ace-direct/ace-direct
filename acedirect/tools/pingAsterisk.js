const AmiClient = require('asterisk-ami-client');

const nconf = require('nconf');
const fs = require('fs');
const asteriskManager = require('asterisk-manager');
const client = new AmiClient();

let cfile = '';
if (process.argv.length === 3) {
  cfile = process.argv[2];
} else {
  console.log('\nusage: node pingAsterisk.js  <config file path>\n');
  process.exit(process.argv.length);
}

const content = fs.readFileSync(cfile, 'utf8');
const myjson = JSON.parse(content);
nconf.file({
  file: cfile
});
let clearText = false;
if (typeof (nconf.get('common:cleartext')) !== "undefined"  && nconf.get('common:cleartext') !== ""   ) {
  clearText = true;
}

function getConfigVal(param_name) {
  var val = nconf.get(param_name);
  var decodedString = null;
  if (typeof val !== 'undefined' && val !== null) {
    //found value for param_name
    if (clearText) {
      decodedString = val;
    } else {``
      decodedString = Buffer.alloc(val.length, val, 'base64');
    }
  } else {
    decodedString = '';
  }
  return (decodedString.toString());
}


const amiPort = getConfigVal('app_ports:asterisk_ami');
const asteriskIp = getConfigVal('servers:asterisk_private_ip');
const asteriskAmiId = getConfigVal('asterisk:ami:id');
const asteriskAmiPassword = getConfigVal('asterisk:ami:passwd');

const connectToAMI = () => {
  return new Promise(function(resolve, reject) {
    client.connect(asteriskAmiId, asteriskAmiPassword, {host: asteriskIp, port: amiPort})
    .then(amiConnection => {
      client
      .on('connect', () => console.log('Asterisk AMI connect...'))
      .on('event', event => console.log(`Asterisk AMI event: ${event}`))
      .on('data', chunk => console.log(`Asterisk AMI chunk: ${chunk}`))
      .on('response', response => {
        console.log(`Asterisk ${response}`);
        resolve(0); 
      })
      .on('disconnect', () => console.log('Asterisk AMI disconnect...'))
      .on('reconnection', () => console.log('Asterisk AMI reconnection...'))
      .on('internalError', error => {
        console.log(`Asterisk AMI error: ${error}`);
        reject(new Error('ERROR - Asterisk AMI error!'));
      })
      .action({
        Action: 'Ping'
      });
    })
    .catch(error => {
      reject(new Error('ERROR pinging Asterisk'));
    });
  });
};

const go = async () => {
  let rc = 1; 
  try {
    rc = await connectToAMI();
    if (rc === 0) {
      console.log('SUCCESS - Asterisk ping worked!');
      client.disconnect();
      process.exit(0); 
    } else {
      console.log('ERROR - Asterisk ping failed!');
      client.disconnect();
      process.exit(1); 
    }
  } catch(e) {
    console.log('ERROR - Asterisk ping failed!');
    client.disconnect();
    process.exit(1);
  }
}

go();
