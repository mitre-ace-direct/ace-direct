// include file for parsing config.json from other programs
const fs = require('fs');
const nconf = require('nconf');

// use global AD config file
const cfile = '../../dat/config.json';
let clearText = false;
const content = fs.readFileSync(cfile, 'utf8');
try {
  JSON.parse(content);
} catch (ex) {
  console.log('\n*******************************************************');
  console.log(`Error! Malformed configuration file: ${cfile}`);
  console.log('Exiting...');
  console.log('*******************************************************\n');
  process.exit(1);
}
nconf.file({ file: cfile });
if (typeof (nconf.get('common:cleartext')) !== 'undefined' && nconf.get('common:cleartext') !== '') {
  clearText = true;
}

module.exports = {
  getConfigVal: (paramName) => {
    const val = nconf.get(paramName);
    let decodedString = null;
    if (typeof val !== 'undefined' && val !== null) {
      decodedString = null;
      if (clearText) {
        decodedString = val;
      } else {
        decodedString = Buffer.alloc(val.length, val, 'base64');
      }
    } else {
      console.error('\n*******************************************************');
      console.error(`ERROR!!! Config parameter is missing: ${paramName}`);
      console.error('*******************************************************\n');
      decodedString = '';
    }
    return (decodedString.toString());
  }
};
