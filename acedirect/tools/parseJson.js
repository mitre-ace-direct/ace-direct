const nconf = require('nconf');
// const fs = require('fs');

// get params
let param = 'abc';
let cfile = '';
if (process.argv.length === 4) {
  [, , param, cfile] = process.argv;
} else {
  console.log('\nusage: node parseJson.js  <param>  <config file path>\n');
  process.exit(process.argv.length);
}

// const content = fs.readFileSync(cfile, 'utf8');
// const myjson = JSON.parse(content);
nconf.file({
  file: cfile
});

let clearText = false;
if (typeof (nconf.get('common:cleartext')) !== 'undefined' && nconf.get('common:cleartext') !== '') {
  clearText = true;
}

/**
 * Function to verify the config parameter name and
 * decode it from Base64 (if necessary).
 * @param {type} param_name of the config parameter
 * @returns {unresolved} Decoded readable string.
 */
function getConfigVal(paramName) {
  const val = nconf.get(paramName);
  let decodedString = null;
  if (typeof val !== 'undefined' && val !== null) {
    // found value for paramName
    if (clearText) {
      decodedString = val;
    } else {
      decodedString = Buffer.alloc(val.length, val, 'base64');
    }
  } else {
    decodedString = '';
  }
  return (decodedString.toString());
}

console.log(getConfigVal(param));
