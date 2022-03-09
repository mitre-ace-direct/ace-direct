
const config = require('./../../dat/config.json');
const request = require('request');
const fs = require('fs');
const randomstring = require('randomstring');
const log4js = require('log4js');
const logger = log4js.getLogger('ad_server');

/**
 * Calls the RESTful service running on the provider host to verify VRS number.
 * Note, this is an emulated VRS check.
 *
 * @param {type} phoneNumber
 * @param {type} callback
 * @returns {undefined}
 */
module.exports.getCallerInfo = (phoneNumber, callback) => {
    let url = `https://${getConfigVal(config.servers.main_private_ip)}:${getConfigVal(config.app_ports.userver)}`;
    // remove the leading characters and 1 before the VRS number (if it's there)
    phoneNumber = phoneNumber.toString();
    while (phoneNumber.length > 10) {
        phoneNumber = phoneNumber.substring(1);
    }
    url += `/vrsverify/?vrsnum=${phoneNumber}`;
    request({
        url,
        json: true
    }, (error, response, data) => {
        if (error) {
            console.log("error", error)
            logger.error('ERROR: /getAllVrsRecs');
            var data = {
                message: 'failed'
            };
        }
        logger.info(`VRS lookup response: ${data.message}`);
        console.log(`VRS lookup response: ${data.message}`);
        callback(data);
    });
}

/**
 * Calls the RESTful service running on the provider host to verify the agent
 * username and password.
 *
 * @param {type} username Agent username
 * @param {type} callback Returns retrieved JSON
 * @returns {undefined} Not used
 */
module.exports.getUserInfo = (username, callback) => {
    const url = `https://${getConfigVal(config.servers.main_private_ip)}:${parseInt(getConfigVal(config.app_ports.aserver), 10)}/getagentrec/${username}`;
    request({
        url,
        json: true
    }, (error, response, data) => {
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
}

/**
 * Loads a new config file color config file into memory.
 *
 * @returns {undefined}
 */
 module.exports.loadColorConfigs = () => {
    const colorfile = './../dat/color_config.json';
    try {
      const content = fs.readFileSync(colorfile, 'utf8');
      myjson = JSON.parse(content);
      colorConfigs = myjson.statuses;
      return colorConfigs;
    } catch (ex) {
      logger.error(`Error in ${colorfile}`);
      return {}
    }
  }

module.exports.createToken = () => {
    // should Check for duplicate tokens
    return randomstring.generate({
      length: 12,
      charset: 'alphabetic'
    });
  }

  module.exports.getConfigVal = (val) => {
    return getConfigVal(val)
  }

/**
* Function to verify the config parameter name and
* decode it from Base64 (if necessary).
* @param {type} param_name of the config parameter
* @returns {unresolved} Decoded readable string.
*/
function getConfigVal(val){
    let decodedString = null;
    if (typeof val !== 'undefined' && val !== null) {
        // found value for paramName
        if (config.clearText != true) {
            decodedString = val;
        } else {
            decodedString = Buffer.alloc(val.length, val, 'base64');
        }
    } else {
        // did not find value for paramName
        logger.error('');
        logger.error('*******************************************************');
        logger.error(`ERROR!!! Config parameter is missing: ${paramName}`);
        logger.error('*******************************************************');
        logger.error('');
        decodedString = '';
    }
    console.log(decodedString.toString())
    return (decodedString.toString());
}


