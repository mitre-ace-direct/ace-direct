var nconf = require('nconf');
var fs = require('fs');
var cfile = './dat/config.json';
var content = fs.readFileSync(cfile, 'utf8');
var myjson = JSON.parse(content);

nconf.file({
  file: cfile
});

var clearText = false;
if (typeof (nconf.get('common:cleartext')) !== "undefined"  && nconf.get('common:cleartext') !== ""   ) {
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


let param = 'abc';
if (process.argv.length >= 3) {
  param = process.argv[2];
} 

console.log( getConfigVal(param) );
