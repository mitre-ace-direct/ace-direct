const nconf = require('nconf');

const cfile = '../dat/config.json'; // Config file
nconf.argv().env();
nconf.file({
  file: cfile
});

// the presence of a populated cleartext field indicates that the file is unencoded
// remove cleartext or set it to "" to idicate that the file is encoded
let clearText = false;
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
exports.getConfigVal = function GetConfigVal(paramName) {
  const val = nconf.get(paramName);
  let decodedString = '';
  if (typeof val !== 'undefined' && val !== null) {
    // found value for paramName
    decodedString = null;
    if (clearText) {
      decodedString = val;
    } else {
      decodedString = Buffer.from(val, 'base64');
    }
  } else {
    // did not find value for paramName
    console.log('');
    console.log('*******************************************************');
    console.log(`ERROR!!! Config parameter is missing: ${paramName}`);
    console.log('*******************************************************');
    console.log('');
    decodedString = '';
  }
  return (decodedString.toString());
};

/**
 * Function that sets the rgb fields in the json file from a given color (for light config page)
 * @param {jsonData} a json object of the color_config.json file
 * @param {status} the status index to update the correct status info in the json file
 * @param {color} the name of the color
 * @returns {return} the updated json object
 */
exports.setRgbValues = function SetRgbValues(jsonData, status, color) {
  const newJsonData = jsonData;
  // jsonData.statuses[status] gets you the fields of each specific status
  if (color === 'red') {
    newJsonData.statuses[status].r = 255;
    newJsonData.statuses[status].g = 0;
    newJsonData.statuses[status].b = 0;
  } else if (color === 'green') {
    newJsonData.statuses[status].r = 0;
    newJsonData.statuses[status].g = 255;
    newJsonData.statuses[status].b = 0;
  } else if (color === 'blue') {
    newJsonData.statuses[status].r = 0;
    newJsonData.statuses[status].g = 0;
    newJsonData.statuses[status].b = 255;
  } else if (color === 'orange') {
    newJsonData.statuses[status].r = 255;
    newJsonData.statuses[status].g = 50;
    newJsonData.statuses[status].b = 0;
  } else if (color === 'yellow') {
    newJsonData.statuses[status].r = 255;
    newJsonData.statuses[status].g = 255;
    newJsonData.statuses[status].b = 0;
  } else if (color === 'pink') {
    newJsonData.statuses[status].r = 255;
    newJsonData.statuses[status].g = 0;
    newJsonData.statuses[status].b = 255;
  } else if (color === 'aqua') {
    newJsonData.statuses[status].r = 0;
    newJsonData.statuses[status].g = 255;
    newJsonData.statuses[status].b = 255;
  } else {
    // color is white
    newJsonData.statuses[status].r = 255;
    newJsonData.statuses[status].g = 255;
    newJsonData.statuses[status].b = 255;
  }
  return newJsonData;
};
