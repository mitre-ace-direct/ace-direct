const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('request');
const fs = require('fs');
const AWS = require('aws-sdk');
const proxy = require('proxy-agent');
const logger = require('../helpers/logger');
const { getConfigVal } = require('../helpers/utility');
const validator = require('../utils/validator');
const config = require('../../dat/config.json');

AWS.config.update({
  region: config.s3.region,
  httpOptions: {
    agent: proxy(config.common.proxy)
  }
});
const s3 = new AWS.S3();

const router = express.Router();

const role = 'AD Agent';

function restrict(req, res, next) {
  if (req.session.isLoggedIn && (req.session.user.role === 'Manager' || req.session.user.role === 'Supervisor')) {
    next();
  } else {
    res.redirect(getConfigVal('nginx:fognito_path'));
  }
}

function generateHash(password, bcrypt) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
}

// NGINX path parameter
let nginxPath = getConfigVal('nginx:mp_path');
if (nginxPath.length === 0) {
  // default for backwards compatibility
  nginxPath = '/ManagementPortal';
}

/**
 * Handles a GET request for / Checks if user has
 * a valid session, if so display dashboard else
 * display login page.
 *
 * @param {string} '/'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 */
router.get('/', restrict, (_req, res) => {
  res.redirect('./dashboard');
});

/**
 * Handles a GET request for /dashboard. Checks user has
 * a valid session and displays dashboard page.
 *
 * @param {string} '/dashboard'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 */
router.get('/dashboard', restrict, (_req, res) => {
  res.render('pages/dashboard');
});

/**
 * Handles a GET request for /cdr. Checks user has
 * a valid session and displays CDR page.
 *
 * @param {string} '/cdr'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 */
router.get('/cdr', restrict, (_req, res) => {
  res.render('pages/cdr');
});

/**
 * Handles a GET request for /report. Checks user has
 * a valid session and displays report page.
 *
 * @param {string} '/report'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 */
router.get('/report', restrict, (_req, res) => {
  res.render('pages/report');
});

/**
 * Handles a GET request for /webrtcstats. Checks user has
 * a valid session and displays report page.
 *
 * @param {string} '/webrtcstats'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 */
router.get('/webrtcstats', restrict, (_req, res) => {
  res.render('pages/webrtcstats');
});

/**
 * Handles a GET request for /videomail. Checks user has
 * a valid session and displays videomail page.
 *
 * @param {string} '/videomail'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 */
router.get('/videomail', restrict, (_req, res) => {
  res.render('pages/videomail');
});

/**
 * Handles a GET request for /getVideoamil to retrieve the videomail file
 * @param {string} '/getVideomail'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 */
router.get('/getVideomail', restrict, (req, res) => {
  console.log('/getVideomail');
  const videoId = req.query.id;
  console.log(`id: ${videoId}`);

  // Wrap in mysql query
  req.dbConnection.query('SELECT video_filepath AS filepath, video_filename AS filename FROM videomail WHERE id = ?', videoId, (errQuery, result) => {
    if (errQuery) {
      console.log('GET VIDEOMAIL ERROR: ', errQuery.code);
    } else {
      if (result[0].filepath === 's3') {
        console.log(result[0].filename);
        const file = s3.getObject(
          { Bucket: config.s3.bucketname, Key: result[0].filename }
        );

        res.writeHead(200, {
          'Content-Type': 'video/webm',
          'Accept-Ranges': 'bytes'
        });
        const filestream = file.createReadStream();
        filestream.pipe(res);
      } else {
        try {
          const videoFile = result[0].filepath + result[0].filename;
          const stat = fs.statSync(videoFile);
          res.writeHead(200, {
            'Content-Type': 'video/webm',
            'Content-Length': stat.size
          });
          const readStream = fs.createReadStream(videoFile);
          readStream.pipe(res);
        } catch (err) {
          console.log(err);
        }
      }
    }
  });
});

/**
 * Handles a GET request for /light. Checks user has
 * a valid session and displays light page.
 *
 * @param {string} '/light'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 */
router.get('/light', restrict, (_req, res) => {
  res.render('pages/light');
});

/**
 * Handles a GET request for /hours. Checks user has
 * a valid session and displays Hours page.
 *
 * @param {string} '/hours'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 */
router.get('/hours', restrict, (_req, res) => {
  res.render('pages/hours');
});

/**
 * Handles a GET request for /callblocking. Checks user has
 * a valid session and displays Call Blocking page.
 *
 * @param {string} '/callblocking'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 */
router.get('/callblocking', restrict, (_req, res) => {
  res.render('pages/callblocking', {
    callblocks: []
  });
});

/**
 *  * Calls the RESTful service running on the provider host to retrieve agent information.
 *  *
 *  * @param {type} username Agent username, if username is null, retrieve all agent records
 *  * @param {type} callback Returns retrieved JSON
 *  * @returns {undefined} Not used
 *  */
function getAgentInfo(username, callback) {
  let url;

  if (username) {
    url = `https://${getConfigVal('servers:main_private_ip')}:${parseInt(getConfigVal('app_ports:mserver'), 10)}/getagentrec/${username}`;
  } else {
    url = `https://${getConfigVal('servers:main_private_ip')}:${parseInt(getConfigVal('app_ports:mserver'), 10)}/getallagentrecs`;
  }
  logger.info(`getAgentInfo query URL: ${url}`);

  request({
    url,
    json: true
  }, (error, _response, dataIn) => {
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
}

/**
 * Handles a GET request for /users. Checks user has
 * a valid session and displays Hours page.
 *
 * @param {string} '/users'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 *
 */
router.get('/users', restrict, (_req, res) => {
  /* TODO: retrieve the current agent list from mserver and populate 'users' */
  getAgentInfo(null, (info) => {
    if (info.message === 'success') {
      logger.info(`Returned agent data[0]${info.data[0].username}`);

      // only return the info of records with role AD Agent
      res.render('pages/users', {
        users: info.data.filter((item) => item.role === role)

      });
    }
  });
});

/**
 * Handles a GET request for /admin. Checks user has
 * a valid session and displays Administration page.
 *
 * @param {string} '/admin'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 */
router.get('/admin', restrict, (_req, res) => {
  getAgentInfo(null, (info) => {
    if (info.message === 'success') {
      logger.info(`Returned agent data[0]${info.data[0].username}`);
      res.render('pages/admin');
    }
  });
});

/**
 * Handles a GET request for token and returnes a valid JWT token
 * for Manager's with a valid session.
 *
 * @param {string} '/token'
 * @param {function} 'restrict'
 * @param {function} function(req, res)
 */
router.get('/token', restrict, (req, res) => {
  const token = jwt.sign(
    { id: req.session.user.agent_id, username: req.session.user.username },
    getConfigVal('web_security:json_web_token:secret_key'),
    { expiresIn: parseInt(getConfigVal('web_security:json_web_token:timeout'), 10) }
  );
  res.status(200).json({ message: 'success', token });
});

/**
 * Handles a GET request for logout, destroys session
 * and redirects the user to the login page.
 *
 * @param {string} '/logout'
 * @param {function} function(req, res)
 */
router.get('/logout', (req, res) => {
  req.session.user = null;
  req.session.save((_err1) => {
    req.session.regenerate((_err2) => {
      res.redirect(req.get('referer'));
    });
  });
});

/**
 * Handles a POST from front end to add an agent
 *
 * @param {string} '/addAgent'
 * @param {function} function(req, res)
 *
 */
router.post('/AddAgent', restrict, (req, res) => {
  const { username } = req.body;
  const { password } = req.body;
  const firstName = req.body.first_name;
  const lastName = req.body.last_name;
  const { email } = req.body;
  const { phone } = req.body;
  const { organization } = req.body;
  const { extension } = req.body;
  const queueId = parseInt(req.body.queue_id, 10);
  const queue2Id = parseInt(req.body.queue2_id, 10);

  logger.debug(`Hit AddAgent with data: ${JSON.stringify(req.body)}`);

  if (validator.isUsernameValid(username)
    && validator.isNameValid(firstName) && validator.isNameValid(lastName)
    && validator.isPasswordComplex(password)
    && validator.isEmailValid(email) && validator.isPhoneValid(phone)) {
    getAgentInfo(username, (info) => {
      if (info.message === 'success') {
        console.error(`User already in DB: ${username}`);
        res.send({
          result: 'fail',
          message: 'Username already exists, cannot add'
        });
      } else {
        // prepare added user data
        const url = `https://${getConfigVal('servers:main_private_ip')}:${parseInt(getConfigVal('app_ports:mserver'), 10)}/addAgents/`;

        // create newAgent JSON object from inputs

        const newAgent = {
          data: [{
            username,
            password,
            first_name: firstName,
            last_name: lastName,
            role,
            phone,
            email,
            organization,
            is_approved: 1,
            is_active: 1,
            extension_id: extension,
            queue_id: queueId,
            queue2_id: queue2Id
          }]
        };

        logger.debug(`New agent to be added: ${JSON.stringify(newAgent)}`);

        request.post({
          url,
          json: true,
          body: newAgent
        }, (error, response, data) => {
          logger.debug(`mserver call response: ${JSON.stringify(response)}`);
          logger.debug(`mserver call data: ${JSON.stringify(data)}`);
          if (error) {
            logger.error(`AddAgent ERROR: ${error}`);
            res.send({
              result: 'fail',
              message: data.message
            });
          } else {
            logger.info(`Agent added in mserver: ${data.message}`);

            // local strategy agent add
            if (getConfigVal('fognito:strategy') === 'local') {
              logger.info(`passport local strategy update: ${username}`);
              const UserModel = req.userModel;
              const query = { 'local.id': username };
              const addUpdate = {
                local: {
                  id: username,
                  password: generateHash(password, req.bcrypt),
                  email,
                  role,
                  displayName: `${firstName} ${lastName}`
                }
              };
              UserModel.findOneAndUpdate(query, addUpdate, {
                upsert: true,
                useFindAndModify: false
              }, (err, _doc) => {
                if (err) {
                  logger.error(`UserModel add error: ${err}`);
                } else {
                  logger.info('Agent password add in MongoDB User');
                }
              });
            }

            res.send({
              result: 'success',
              message: data.message
            });
          }
        });
      }
    });
  } else {
    res.send({
      result: 'fail',
      message: 'Invalid inputs, cannot add'
    });
  }
});

/**
 * Handles a POST from front end to update an agent
 *
 * @param {string} '/UpdateAgent'
 * @param {function} function(req, res)
 *
 */
router.post('/UpdateAgent', restrict, (req, res) => {
  const agentId = req.body.agent_id;
  const { username } = req.body;
  const { password } = req.body;
  const firstName = req.body.first_name;
  const lastName = req.body.last_name;
  const { email } = req.body;
  const { phone } = req.body;
  const { organization } = req.body;
  const extension = parseInt(req.body.extension, 10);
  const queueId = parseInt(req.body.queue_id, 10);
  const queue2Id = parseInt(req.body.queue2_id, 10);
  const profilePicture = req.body.profile_picture;

  if (validator.isNameValid(firstName) && validator.isNameValid(lastName)
    && validator.isPasswordComplex(password)
    && validator.isEmailValid(email) && validator.isPhoneValid(phone)) {
    getAgentInfo(username, (info) => {
      if (info.message !== 'success') {
        logger.error(`User does not exist in DB: ${username}`);
        res.send({
          result: 'fail',
          message: 'Username does not exist in DB, cannot update'
        });
      } else {
        // prepare user data
        const url = `https://${getConfigVal('servers:main_private_ip')}:${parseInt(getConfigVal('app_ports:mserver'), 10)}/UpdateProfile/`;

        // create newAgent JSON object from inputs

        const newAgent = {
          agent_id: agentId,
          first_name: firstName,
          last_name: lastName,
          role,
          phone,
          email,
          organization,
          is_approved: 1,
          is_active: 1,
          extension,
          queue_id: queueId,
          queue2_id: queue2Id,
          profile_picture: profilePicture
        };

        logger.debug(`Agent data to be updated: ${JSON.stringify(newAgent)}`);
        request.post({
          url,
          json: true,
          body: newAgent
        }, (error, response, data) => {
          logger.debug(`mserver call response: ${JSON.stringify(response)}`);
          logger.debug(`mserver call data: ${JSON.stringify(data)}`);
          if (error) {
            logger.error(`UpdateAgent ERROR: ${error}`);
            res.send({
              result: 'fail',
              message: data.message
            });
          } else {
            logger.info(`Agent updated: ${data.message}`);

            // local authentication agent update
            if (getConfigVal('fognito:strategy') === 'local') {
              logger.info(`passport local strategy update: ${username}`);
              const UserModel = req.userModel;
              const query = { 'local.id': username };
              const addUpdate = {
                local: {
                  id: username,
                  password: generateHash(password, req.bcrypt),
                  email,
                  role,
                  displayName: `${firstName} ${lastName}`
                }
              };
              UserModel.findOneAndUpdate(query, addUpdate, {
                upsert: true,
                useFindAndModify: false
              }, (err, _doc) => {
                if (err) {
                  logger.error(`UserModel update error: ${err}`);
                } else {
                  logger.info('Agent password updated in MongoDB User');
                }
              });
            }

            res.send({
              result: 'success',
              message: data.message
            });
          }
        });
      }
    });
  } else {
    res.send({
      result: 'fail',
      message: 'Invalid inputs, cannot update'
    });
  }
});

/**
 * Handles a POST from front end to add an agent
 *
 * @param {string} '/DeleteAgent'
 * @param {function} function(req, res)
 *
 */
router.post('/DeleteAgent', restrict, (req, res) => {
  const agentId = req.body.id;
  const { username } = req.body;

  logger.info(`Hit DeleteAgent with agentId: ${agentId}, username: ${username}`);

  if (agentId) {
    const url = `https://${getConfigVal('servers:main_private_ip')}:${parseInt(getConfigVal('app_ports:mserver'), 10)}/DeleteAgent/`;

    request.post({
      url,
      json: true,
      body: { agent_id: agentId }
    }, (error, response, data) => {
      logger.debug(`mserver call response: ${JSON.stringify(response)}`);
      if (error) {
        logger.error(`DeleteAgent ERROR: ${error}`);
        res.send({
          result: 'fail',
          message: data.message
        });
      } else {
        logger.info(`Agent deleteed: ${data.message}`);

        // local strategy agent delete
        if (getConfigVal('fognito:strategy') === 'local') {
          logger.info(`passport local strategy update: ${username}`);
          const UserModel = req.userModel;
          const query = { 'local.id': username };
          UserModel.deleteMany(query, (err, _doc) => {
            if (err) {
              logger.error(`UserModel delete error: ${err}`);
            } else {
              logger.info('Agent deleted in MongoDB User');
            }
          });
        }

        res.send({
          result: 'success',
          message: data.message
        });
      }
    });
  } else {
    res.send({
      result: 'fail',
      message: 'Invalid inputs, cannot add'
    });
  }
});

/**
 * Handles a GET from front end to load an agent data
 *
 * @param {string} '/GetAgent'
 * @param {function} function(req, res)
 *
 */
router.get('/GetAgent', restrict, (req, res) => {
  const { username } = req.query;

  logger.info(`Hit GetAgent with username: ${username}`);

  getAgentInfo(username, (info) => {
    if (info.message === 'success') {
      logger.info('User found in DB: ');
      logger.info(JSON.stringify(info.data[0]));
      res.send(info.data[0]);
    }
  });
});

/**
 * Handler function for getting an agent from the database.
 */

const getAgent = (usnm) => new Promise((resolve, reject) => {
  // console.log('Getting agent! Username: ', usnm);
  // console.log('get agent link', `https://${config.servers.main_private_ip}:${config.app_ports.mserver}/getagentrec/${usnm}`);
  request({
    method: 'GET',
    headers: { Accept: 'application/json' },
    url: `https://${config.servers.main_private_ip}:${config.app_ports.mserver}/getagentrec/${usnm}`
  }, (error, _response, data) => {
    if (error) {
      console.error('Error! Could not get agent:', error);
      reject(error);
    } else {
      // console.log('Success! Agent found!');
      // console.log('Data: ', typeof data);
      // console.log(`TEXT ${JSON.parse(data)}`);
      // eslint-disable-next-line no-lonely-if
      if (data.length > 0) {
        const jsonData = JSON.parse(data);
        resolve(jsonData);
      // eslint-disable-next-line prefer-promise-reject-errors
      } else reject('Agent cannot be found!');
    }
  });
});

/**
 * Handles populating all profile picture image tags seen throughout the management portal.
 *
 * @param {string} '/profilePic/:username
 *
 */

router.get('/ProfilePic/:username', (req, res) => {
  // console.log(`/ProfilePic/${req.params.username} endpoint called!`);
  let key = '';

  let image;

  res.set({
    'Content-Type': 'image/*'
  });

  getAgent(req.params.username).then((data) => {
    if (data.data[0].profile_picture && data.data[0].profile_picture !== '') {
      key = data.data[0].profile_picture;

      // console.log('TYPEOF DATA:', typeof data);
      // console.log('data.data[0].profile_picture:', data.data[0].profile_picture);
      // console.log('typeof data.data[0].profile_picture', typeof data.data[0].profile_picture);
      const options = {
        Bucket: config.s3.bucketname,
        Key: key
      };
      s3.getObject(options, (err, data1) => {
        if (err) {
          console.error('Error retrieving s3 object', key, err);
        } else {
          image = data1.Body;
          res.send(image);
        }
      });
    } else {
      fs.readFile('./public/images/anon.png', (err, data2) => {
        if (err) {
          console.error('Could not read image!', err);
        } else {
          // console.log(data2);
          res.send(data2);
        }
      });
    }
  }).catch((err) => {
    console.log('Error finding agent!', err);
    fs.readFile('./public/images/anon.png', (err1, data) => {
      if (err1) {
        console.log('Could not read image!', err1);
      } else {
        console.log(data);
        res.send(data);
      }
    });
  });
});

router.get('/profilePicPoll/:username', (req, res) => {
  const profilePicFlag = { profilePicExists: false };

  getAgent(req.params.username).then((data) => {
    if (data.data[0].profile_picture && data.data[0].profile_picture.length > 1) {
      console.log('User has a profile pic saved!');
      profilePicFlag.profilePicExists = true;
    }
    res.send(profilePicFlag);
  });
});

module.exports = router;
