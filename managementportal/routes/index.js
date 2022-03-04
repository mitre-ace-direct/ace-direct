const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('request');
const urlparse = require('url');
const logger = require('../helpers/logger');
const { getConfigVal } = require('../helpers/utility');
const validator = require('../utils/validator');

const router = express.Router();

function restrict(req, res, next) {
  if (req.session.isLoggedIn && (req.session.user.role === 'Manager' || req.session.user.role === 'Supervisor')) {
    next()
  } else {
    res.redirect(getConfigVal('nginx:fognito_path'));
  }
};



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
router.get('/', restrict, (req, res) => {
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
router.get('/dashboard', restrict, (req, res) => {
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
router.get('/cdr', restrict, (req, res) => {
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
router.get('/report', restrict, (req, res) => {
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
router.get('/webrtcstats', restrict, (req, res) => {
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
router.get('/videomail', restrict, (req, res) => {
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
  const { agent } = req.query;
  console.log(`id: ${videoId}`);

  // Wrap in mysql query
  req.dbConnection.query('SELECT video_filepath AS filepath, video_filename AS filename FROM videomail WHERE id = ?', videoId, (errQuery, result) => {
    if (errQuery) {
      console.log('GET VIDEOMAIL ERROR: ', errQuery.code);
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
router.get('/light', restrict, (req, res) => {
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
router.get('/hours', restrict, (req, res) => {
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
router.get('/callblocking', restrict, (req, res) => {
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
    url = `https://${getConfigVal('servers:main_private_ip')}:${parseInt(getConfigVal('app_ports:aserver'), 10)}/getagentrec/${username}`;
  } else {
    url = `https://${getConfigVal('servers:main_private_ip')}:${parseInt(getConfigVal('app_ports:aserver'), 10)}/getallagentrecs`;
  }
  logger.info(`getAgentInfo query URL: ${url}`);

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
router.get('/users', restrict, (req, res) => {
  /* TODO: retrieve the current agent list from aserver and populate 'users' */
  getAgentInfo(null, (info) => {
    if (info.message === 'success') {
      logger.info(`Returned agent data[0]${info.data[0].username}`);

      // only return the info of records with role AD Agent
      res.render('pages/users', {
        users: info.data.filter((item) => item.role === 'AD Agent')

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
router.get('/admin', restrict, (req, res) => {
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
  req.session.destroy();
  res.redirect(req.get('referer'));
});

/**
 * Contains all local strategy related operation to manage agents
 *
 * @param - none
 * @return - none
 *
 * */
function localStrategyOperation(operation, username, password) {
  // only update if strategy is local. 
  if(getConfigVal('fognito:strategy')!=='local')
    return;

  logger.info(`localStrategyOperation with info: ${operation} ${username}`);
  switch (operation) {
    case 'addAgent':
      logger.info('localStrategy addAgent');
      // Ed - I tied the mongodb connection to the req object. So we can remove this function all together and just called req.mongoConnection.update.... from inside the route. 
      //Mongo Add
      break;

    case 'updateAgent':
      logger.info('localStrategy updateAgent');
      //Mongo Update
      break;

    case 'deleteAgent':
      logger.info('localStrategy deleteAgent');
      //Mongo Delete
      break;
    default:
      break;
  }
};

/**
 * Handles a POST from front end to add an agent
 *
 * @param {string} '/addAgent'
 * @param {function} function(req, res)
 *
 * TODO: need to add the agent into openAM DB
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
        const url = `https://${getConfigVal('servers:main_private_ip')}:${parseInt(getConfigVal('app_ports:aserver'), 10)}/addAgents/`;

        // create newAgent JSON object from inputs

        const newAgent = {
          data: [{
            username,
            password,
            first_name: firstName,
            last_name: lastName,
            role: 'AD Agent',
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
          logger.debug(`aserver call response: ${JSON.stringify(response)}`);
          logger.debug(`aserver call data: ${JSON.stringify(data)}`);
          if (error) {
            logger.error(`AddAgent ERROR: ${error}`);
            res.send({
              result: 'fail',
              message: data.message
            });
          } else {
            logger.info(`Agent added in aserver: ${data.message}`);
            localStrategyOperation('addAgent', username, password);

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
 * TODO: need to add the agent into openAM DB
 */
router.post('/UpdateAgent', restrict, (req, res) => {
  const agentId = req.body.agent_id;
  const { username } = req.body;
  const firstName = req.body.first_name;
  const lastName = req.body.last_name;
  const { email } = req.body;
  const { phone } = req.body;
  const { organization } = req.body;
  const extension = parseInt(req.body.extension, 10);
  const queueId = parseInt(req.body.queue_id, 10);
  const queue2Id = parseInt(req.body.queue2_id, 10);

  if (validator.isNameValid(firstName) && validator.isNameValid(lastName)
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
        const url = `https://${getConfigVal('servers:main_private_ip')}:${parseInt(getConfigVal('app_ports:aserver'), 10)}/UpdateProfile/`;

        // create newAgent JSON object from inputs

        const newAgent = {
          agent_id: agentId,
          first_name: firstName,
          last_name: lastName,
          role: 'AD Agent',
          phone,
          email,
          organization,
          is_approved: 1,
          is_active: 1,
          extension,
          queue_id: queueId,
          queue2_id: queue2Id
        };

        logger.debug(`Agent data to be updated: ${JSON.stringify(newAgent)}`);

        request.post({
          url,
          json: true,
          body: newAgent
        }, (error, response, data) => {
          logger.debug(`aserver call response: ${JSON.stringify(response)}`);
          logger.debug(`aserver call data: ${JSON.stringify(data)}`);
          if (error) {
            logger.error(`UpdateAgent ERROR: ${error}`);
            res.send({
              result: 'fail',
              message: data.message
            });
          } else {
            logger.info(`Agent updated: ${data.message}`);


            localStrategyOperation('updateAgent', username);

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
 * TODO: need to add the agent into openAM DB
 */
router.post('/DeleteAgent', restrict, (req, res) => {
  const agentId = req.body.id;
  const { username } = req.body;

  logger.info(`Hit DeleteAgent with agentId: ${agentId}, username: ${username}`);

  if (agentId) {
    const url = `https://${getConfigVal('servers:main_private_ip')}:${parseInt(getConfigVal('app_ports:aserver'), 10)}/DeleteAgent/`;

    request.post({
      url,
      json: true,
      body: { agent_id: agentId }
    }, (error, response, data) => {
      logger.debug(`aserver call response: ${JSON.stringify(response)}`);
      if (error) {
        logger.error(`DeleteAgent ERROR: ${error}`);
        res.send({
          result: 'fail',
          message: data.message
        });
      } else {
        logger.info(`Agent deleteed: ${data.message}`);

        localStrategyOperation('deleteAgent', username); 

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

module.exports = router;
