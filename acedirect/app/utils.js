const request = require('request');
const fs = require('fs');
const randomstring = require('randomstring');
const log4js = require('log4js');
const config = require('../../dat/config.json');

const logger = log4js.getLogger('ad_server');

/**
* Function to verify the config parameter name and
* decode it from Base64 (if necessary).
* @param {type} param_name of the config parameter
* @returns {unresolved} Decoded readable string.
*/
function getConfigVal(val) {
  let decodedString = null;
  if (typeof val !== 'undefined' && val !== null) {
    // found value for parameter named val
    if (config.clearText !== true) {
      decodedString = val;
    } else {
      decodedString = Buffer.alloc(val.length, val, 'base64');
    }
  } else {
    // did not find value for parameter named val
    logger.error('');
    logger.error('*******************************************************');
    logger.error(`ERROR!!! Config parameter is missing: ${val}`);
    logger.error('*******************************************************');
    logger.error('');
    decodedString = '';
  }
  return (decodedString.toString());
}

module.exports.getConfigVal = (val) => getConfigVal(val);

/**
 * Calls the RESTful service running on the provider host to verify VRS number.
 * Note, this is an emulated VRS check.
 *
 * @param {type} phoneNumber
 * @param {type} callback
 * @returns {undefined}
 */
module.exports.getCallerInfo = (phoneNumberIn, callback) => {
  let phoneNumber = phoneNumberIn;
  let url = `https://${getConfigVal(config.servers.main_private_ip)}:${getConfigVal(config.app_ports.mserver)}`;
  // remove the leading characters and 1 before the VRS number (if it's there)
  phoneNumber = phoneNumber.toString();
  while (phoneNumber.length > 10) {
    phoneNumber = phoneNumber.substring(1);
  }
  url += `/vrsverify/?vrsnum=${phoneNumber}`;
  request({
    url,
    json: true
  }, (error, response, dataIn) => {
    let data = dataIn;
    if (error) {
      console.log('error', error);
      logger.error('ERROR: /getAllVrsRecs');
      data = {
        message: 'failed'
      };
    }
    logger.info(`VRS lookup response: ${data.message}`);
    console.log(`VRS lookup response: ${data.message}`);
    callback(data);
  });
};

/**
 * Calls the RESTful service running on the provider host to verify the agent
 * username and password.
 *
 * @param {type} username Agent username
 * @param {type} callback Returns retrieved JSON
 * @returns {undefined} Not used
 */
module.exports.getUserInfo = (username, callback) => {
  const url = `https://${getConfigVal(config.servers.main_private_ip)}:${parseInt(getConfigVal(config.app_ports.mserver), 10)}/getagentrec/${username}`;
  request({
    url,
    json: true
  }, (error, response, dataIn) => {
    let data = dataIn;
    if (error) {
      logger.error(`login ERROR: ${error}`);
      data = {
        message: 'failed'
      };
    } else {
      logger.info(`Agent Verify: ${data.message}`);
    }
    callback(data);
  });
};

/**
 * Loads a new config file color config file into memory.
 *
 * @returns {undefined}
 */
module.exports.loadColorConfigs = () => {
  const colorfile = './../dat/color_config.json';
  try {
    const content = fs.readFileSync(colorfile, 'utf8');
    const myjson = JSON.parse(content);
    const colorConfigs = myjson.statuses;
    return colorConfigs;
  } catch (ex) {
    logger.error(`Error in ${colorfile}`);
    return {};
  }
};

// should Check for duplicate tokens
module.exports.createToken = () => randomstring.generate({
  length: 12,
  charset: 'alphabetic'
});
