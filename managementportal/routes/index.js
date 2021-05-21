
const express = require('express');
const jwt = require('jsonwebtoken');
const openamAgent = require('@forgerock/openam-agent');
const request = require('request');
const urlparse = require('url');
const logger = require('../helpers/logger');
const { getConfigVal } = require('../helpers/utility');
const validator = require('../utils/validator');

const router = express.Router();

const agent = new openamAgent.PolicyAgent({
  serverUrl: `https://${getConfigVal('servers:nginx_fqdn')}:${getConfigVal('app_ports:nginx')}/${getConfigVal('openam:path')}`,
  privateIP: getConfigVal('servers:nginx_private_ip'),
  errorPage() {
    return '<html><body><h1>Access Error</h1></body></html>';
  }
});
const cookieShield = new openamAgent.CookieShield({
  getProfiles: false, cdsso: false, noRedirect: false, passThrough: false
});

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
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/', agent.shield(cookieShield), (req, res) => {
  if (req.session.role === 'Manager' || req.session.role === 'Supervisor') {
    res.redirect('./dashboard');
  } else {
    res.redirect('./Logout');
  }
});

/**
 * Handles a GET request for /dashboard. Checks user has
 * a valid session and displays dashboard page.
 *
 * @param {string} '/dashboard'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/dashboard', agent.shield(cookieShield), (req, res) => {
  if (req.session.role === 'Manager' || req.session.role === 'Supervisor') {
    res.render('pages/dashboard');
  } else if (req.session.role !== undefined) {
    console.log('bad role');
    res.redirect('./Logout');
  } else {
    res.redirect('./');
  }
});

/**
 * Handles a GET request for /dashboard. Checks user has
 * a valid session and displays dashboard page.
 *
 * @param {string} '/dashboard'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get(nginxPath, agent.shield(cookieShield), (req, res) => {
  res.redirect(nginxPath);
});

/**
 * Handles a GET request for /cdr. Checks user has
 * a valid session and displays CDR page.
 *
 * @param {string} '/cdr'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/cdr', agent.shield(cookieShield), (req, res) => {
  if (req.session.role === 'Manager' || req.session.role === 'Supervisor') {
    res.render('pages/cdr');
  } else {
    res.redirect('./');
  }
});

/**
 * Handles a GET request for /report. Checks user has
 * a valid session and displays report page.
 *
 * @param {string} '/report'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/report', agent.shield(cookieShield), (req, res) => {
  if (req.session.role === 'Manager' || req.session.role === 'Supervisor') {
    res.render('pages/report');
  } else {
    res.redirect('./');
  }
});

/**
 * Handles a GET request for /webrtcstats. Checks user has
 * a valid session and displays report page.
 *
 * @param {string} '/webrtcstats'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/webrtcstats', agent.shield(cookieShield), (req, res) => {
  if (req.session.role === 'Manager' || req.session.role === 'Supervisor') {
    res.render('pages/webrtcstats');
  } else {
    res.redirect('./');
  }
});

/**
 * Handles a GET request for /videomail. Checks user has
 * a valid session and displays videomail page.
 *
 * @param {string} '/videomail'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/videomail', agent.shield(cookieShield), (req, res) => {
  if (req.session.role === 'Manager' || req.session.role === 'Supervisor') {
    res.render('pages/videomail');
  } else {
    res.redirect('./');
  }
});

/**
 * Handles a GET request for /light. Checks user has
 * a valid session and displays light page.
 *
 * @param {string} '/light'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/light', agent.shield(cookieShield), (req, res) => {
  if (req.session.role === 'Manager' || req.session.role === 'Supervisor') {
    res.render('pages/light');
  } else {
    res.redirect('./');
  }
});

/**
 * Handles a GET request for /hours. Checks user has
 * a valid session and displays Hours page.
 *
 * @param {string} '/hours'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/hours', agent.shield(cookieShield), (req, res) => {
  if (req.session.role === 'Manager' || req.session.role === 'Supervisor') {
    res.render('pages/hours');
  } else {
    res.redirect('./');
  }
});

/**
 * Handles a GET request for /callblocking. Checks user has
 * a valid session and displays Call Blocking page.
 *
 * @param {string} '/callblocking'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/callblocking', agent.shield(cookieShield), (req, res) => {
  if (req.session.role === 'Manager' || req.session.role === 'Supervisor') {
    const data = [];

    res.render('pages/callblocking', {
      callblocks: data
    });
  } else {
    res.redirect('./');
  }
});

/**
 *  * Calls the RESTful service running on the provider host to retrieve agent information
 *  * username and password.
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
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 *
 */
router.get('/users', agent.shield(cookieShield), (req, res) => {
  if (req.session.role === 'Manager' || req.session.role === 'Supervisor') {
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
  } else {
    res.redirect('./');
  }
});

/**
 * Handles a GET request for /admin. Checks user has
 * a valid session and displays Administration page.
 *
 * @param {string} '/admin'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/admin', agent.shield(cookieShield), (req, res) => {
  if (req.session.role === 'Manager' || req.session.role === 'Supervisor') {
    getAgentInfo(null, (info) => {
      if (info.message === 'success') {
        logger.info(`Returned agent data[0]${info.data[0].username}`);
        res.render('pages/admin');
      }
    });
  } else {
    res.redirect('./');
  }
});

/**
 * Handles a GET request for token and returnes a valid JWT token
 * for Manager's with a valid session.
 *
 * @param {string} '/token'
 * @param {function} 'agent.shield(cookieShield)'
 * @param {function} function(req, res)
 */
router.get('/token', agent.shield(cookieShield), (req, res) => {
  if (req.session.role === 'Manager' || req.session.role === 'Supervisor') {
    const token = jwt.sign(
      { id: req.session.agent_id, username: req.session.username },
      getConfigVal('web_security:json_web_token:secret_key'),
      // Buffer.from(getConfigVal('web_security:json_web_token:secret_key'),
      // getConfigVal('web_security:json_web_token:encoding')),
      { expiresIn: parseInt(getConfigVal('web_security:json_web_token:timeout'), 10) }
    );
    res.status(200).json({ message: 'success', token });
  } else {
    req.session.destroy((_err) => {
      res.redirect('./');
    });
  }
});

/**
 * Handles a GET request for logout, destroys session
 * and redirects the user to the login page.
 *
 * @param {string} '/logout'
 * @param {function} function(req, res)
 */
router.get('/logout', (req, res) => {
  request({
    method: 'POST',
    url: `https://${getConfigVal('servers:nginx_private_ip')}:${getConfigVal('app_ports:nginx')}/json/sessions/?_action-logout`,
    headers: {
      host: urlparse.parse(`https://${getConfigVal('servers:nginx_fqdn')}`).hostname,
      iplanetDirectoryPro: req.session.key,
      'Content-Type': 'application/json'
    }
  }, (error) => {
    if (error) {
      logger.error(`logout ERROR: ${error}`);
    } else {
      const domaintemp = getConfigVal('servers:nginx_fqdn');
      const n1 = domaintemp.indexOf('.');
      res.cookie('iPlanetDirectoryPro', 'cookievalue', {
        maxAge: 0,
        domain: domaintemp.substring(n1 + 1),
        path: '/',
        value: ''
      });
      req.session.destroy((_err) => {
        res.redirect(req.get('referer'));
      });
    }
  });
});

/**
 * Contains all openAM related operation to manage agents
 *
 * @param - none
 * @return - none: this function is invoked after aserver update which
 * drives the response code to front end.
 * openAM API calls do not generate response to front-end
 *
 * */
function openAMOperation(openAMAgentInfo) {
  logger.info(`openAMOperation with info: ${JSON.stringify(openAMAgentInfo)}`);

  // Use the approach to access openam from inside the organization network
  const urlPrefix = `https://${getConfigVal('servers:nginx_private_ip')}:${parseInt(getConfigVal('app_ports:nginx'), 10)}/${getConfigVal('openam:path')}`;

  const openAmLoginSuccess = new Promise(
    (resolve, reject) => {
      // authenticate first
      const url = `${urlPrefix}/json/authenticate`;

      logger.debug(`openam url: ${url}`);
      request.post({
        url,
        json: true,
        headers: {
          'X-OpenAM-Username': getConfigVal('openam:user'),
          'X-OpenAM-Password': getConfigVal('openam:password'),
          'Content-Type': 'application/json',
          host: urlparse.parse(`https://${getConfigVal('servers:nginx_fqdn')}`).hostname
        }
      }, (error, response, data) => {
        if (error) {
          logger.error(`openAM ERROR: ${error}`);
          reject(new Error('openAM login failed'));
        } else {
          logger.info('openAM no error');
          logger.debug(`openam call data: ${JSON.stringify(data)}`);
          logger.debug(`openam call response: ${JSON.stringify(response)}`);
          const openamToken = data.tokenId;
          logger.info(`openam logged in successfully with tokenid: ${openamToken}`);
          resolve(openamToken); // resolve Promise with token
        }
      });
    }
  );

  const openAmChange = function OpenAmChange(succTokenId) {
    return new Promise(
      (resolve, _reject) => {
        let url = '';
        switch (openAMAgentInfo.operation) {
          case 'addAgent':
            logger.info('openam addAgent');
            url = `${urlPrefix}/json/users/?_action=create`;
            request.post({
              url,
              json: true,
              headers: {
                iplanetDirectoryPro: succTokenId,
                'Content-Type': 'application/json',
                host: urlparse.parse(`https://${getConfigVal('servers:nginx_fqdn')}`).hostname
              },
              body: {
                username: openAMAgentInfo.username,
                userpassword: openAMAgentInfo.password,
                mail: [openAMAgentInfo.email],
                givenName: [openAMAgentInfo.first_name],
                sn: [openAMAgentInfo.last_name],
                cn: [`${openAMAgentInfo.first_name} ${openAMAgentInfo.last_name}`],
                assignedDashboard: ['Google', 'AgentPortal', 'TicketCenter']
              }
            }, (error, response, data) => {
              if (error) {
                logger.error(`openAM ERROR addAgent: ${error}`);
                // even when the operation fails, pass token to proceed to openam logout
                resolve(succTokenId);
              } else {
                logger.debug(`openam call data: ${JSON.stringify(data)}`);
                logger.debug(`openam call response: ${JSON.stringify(response)}`);
                logger.info(`openam addAgent success username: ${openAMAgentInfo.username}`);
                resolve(succTokenId);
              }
            });

            break;

          case 'updateAgent':
            logger.info('openam updateAgent');
            url = `${urlPrefix}/json/users/${openAMAgentInfo.username}`;
            request.put({
              url,
              json: true,
              headers: {
                iplanetDirectoryPro: succTokenId,
                'Content-Type': 'application/json',
                host: urlparse.parse(`https://${getConfigVal('servers:nginx_fqdn')}`).hostname
              },
              body: { // username and password are not updatable for now
                mail: [openAMAgentInfo.email],
                givenName: [openAMAgentInfo.first_name],
                sn: [openAMAgentInfo.last_name],
                cn: [`${openAMAgentInfo.first_name} ${openAMAgentInfo.last_name}`]
              }
            }, (error, response, data) => {
              if (error) {
                logger.error(`openAM ERROR updateAgent: ${error}`);
                // even when the operation fails, pass token to proceed to openam logout
                resolve(succTokenId);
              } else {
                logger.debug(`openam call data: ${JSON.stringify(data)}`);
                logger.debug(`openam call response: ${JSON.stringify(response)}`);
                logger.info(`openam updateAgent success username: ${openAMAgentInfo.username}`);
                resolve(succTokenId);
              }
            });

            break;

          case 'deleteAgent':
            logger.info('opeam deleteAgent');

            url = `${urlPrefix}/json/users/${openAMAgentInfo.username}`;
            request.delete({
              url,
              json: true,
              headers: {
                iplanetDirectoryPro: succTokenId,
                'Content-Type': 'application/json',
                host: urlparse.parse(`https://${getConfigVal('servers:nginx_fqdn')}`).hostname
              }
            }, (error, response, data) => {
              if (error) {
                logger.error(`openAM ERROR deleteAgent: ${error}`);
                // even when the operation fails, pass token to proceed to openam logout
                resolve(succTokenId);
              } else {
                logger.debug(`openam call data: ${JSON.stringify(data)}`);
                logger.debug(`openam call response: ${JSON.stringify(response)}`);
                logger.info(`openam deleteAgent success username: ${openAMAgentInfo.username}`);
                resolve(succTokenId);
              }
            });

            break;
          default:
            break;
        }
      }
    );
  };

  openAmLoginSuccess.then(openAmChange).then(
    (succTokenId) => {
      // logout openAM: this part should be hit as long as openAM login is successful
      // openAMChange() always resolves with the token so proper openAM logout can be performed

      const openamLogout = `${urlPrefix}/json/sessions/?_action=logout`;

      logger.info(`openam url: ${openamLogout}`);
      request.post({
        url: openamLogout,
        json: true,
        headers: {
          iplanetDirectoryPro: succTokenId,
          'Content-Type': 'application/json',
          host: urlparse.parse(`https://${getConfigVal('servers:nginx_fqdn')}`).hostname
        }
      }, (error, response, data) => {
        if (error) {
          logger.error(`openAM ERROR: ${error}`);
        } else {
          logger.info('openAM logout succ');
          logger.debug(`openam call data: ${JSON.stringify(data)}`);
          logger.debug(`openam call response: ${JSON.stringify(response)}`);
        }
      });
    },
    (error) => {
      // should only come here if the login fails
      logger.error(`openAM login failed: ${error}`);
    }
  );
}

/**
 * Handles a POST from front end to add an agent
 *
 * @param {string} '/addAgent'
 * @param {function} function(req, res)
 *
 * TODO: need to add the agent into openAM DB
 */
router.post('/AddAgent', agent.shield(cookieShield), (req, res) => {
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

  if (validator.isUsernameValid(username) && validator.isPasswordComplex(password)
  && validator.isNameValid(firstName) && validator.isNameValid(lastName)
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

            // add user and passwd into openAM
            const openAMAgentInfo = {
              operation: 'addAgent',
              username,
              password,
              firstName,
              lastName,
              email
            };
            openAMOperation(openAMAgentInfo);

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
router.post('/UpdateAgent', agent.shield(cookieShield), (req, res) => {
  const agentId = req.body.agent_id;
  const { username } = req.body;
  // const { password } = req.body; // Password is not changable now.
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

            // username and password are not changeable now
            const openAMAgentInfo = {
              operation: 'updateAgent',
              username,
              password: '',
              firstName,
              lastName,
              email
            };
            openAMOperation(openAMAgentInfo);

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
router.post('/DeleteAgent', agent.shield(cookieShield), (req, res) => {
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

        // delete the user from openAM
        const openAMAgentInfo = {
          operation: 'deleteAgent',
          username,
          password: '',
          first_name: '',
          last_name: '',
          email: ''
        };
        openAMOperation(openAMAgentInfo);

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
 * @param {string} '/DeleteAgent'
 * @param {function} function(req, res)
 *
 */
router.get('/GetAgent', agent.shield(cookieShield), (req, res) => {
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
