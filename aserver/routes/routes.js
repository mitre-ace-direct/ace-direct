const multer = require('multer');

/**
 * Define the different REST service routes in this file.
 *
 * @param (type) app Instance of express
 * @param (type) connection Retrieves DB from the MySQL server
 * @returns (undefined) Not used
 */

const appRouter = (app, connection, asterisk) => {
/**
     * @api {get} /AgentVerify Verify an agent by username and password.
     * @apiName AgentVerify
     * @apiGroup AgentVerify
     * @apiVersion 1.0.0
     *
     * @apiParam {String} username   username for the agent.
     * @apiParam {String} password   password for the agent.
     *
     * @apiSuccessExample Success-Response
     *     HTTP/1.1 200 OK
     *    {
     *      "message":"success",
     *      "data":[{
     *             agent_id: 0,
     *             username: "CSRAgent0",
     *             first_name: "John",
     *             last_name: "Smith",
     *             phone: "1112223333",
     *             role:"Agent",
     *             email:"jsmith@email.xyz",
     *             organization:"call center xyz",
     *             is_approved: 1,
     *             is_active: 1,
     *             extension: 1234,
     *             extension_secret: "ABC123",
     *             queue_name: "Queue1234",
     *             queue_name: null
     *            }]
     *    }
     * @apiErrorExample 400 Error-Response
     *     HTTP/1.1 400 BadRequest Bad Request Error
     *     {
     *        'message': 'missing username'
     *     }
     * @apiErrorExample 400 Error-Response
     *     HTTP/1.1 400 BadRequest Bad Request Error
     *     {
     *        'message': 'missing password'
     *     }
     * @apiErrorExample 404 Error-Response
     *     HTTP/1.1 404 Not Found
     *     {
     *        'message': 'Login failed'
     *     }
     * @apiErrorExample 500 Error-Response
     *     HTTP/1.1 500 Internal Server Error
     *     {
     *        'message': 'mysql error'
     *     }
     * @apiErrorExample 501 Error-Response
     *     HTTP/1.1 501 Not implemented
     *     {
     *        'message': 'records returned is not 1'
     *     }
     */

  app.get('/agentverify', (req, res) => {
    if (!req.query.username) {
      return res.status(400).send({ message: 'missing username' });
    }
    if (!req.query.password) {
      return res.status(400).send({ message: 'missing password' });
    }

    // Query DB for agent info
    return connection.query('SELECT ad.agent_id, ad.username, ad.first_name, ad.last_name, ad.role, ad.phone, ad.email, ad.organization, ad.is_approved, ad.is_active, ae.extension, ae.extension_secret, aq.queue_name, aq2.queue_name AS queue2_name, ad.layout, oc.channel FROM agent_data AS ad LEFT JOIN asterisk_extensions AS ae ON ad.agent_id = ae.id LEFT JOIN asterisk_queues AS aq ON aq.id = ad.queue_id LEFT JOIN asterisk_queues AS aq2 ON aq2.id = ad.queue2_id LEFT JOIN outgoing_channels AS oc ON oc.id = ae.id WHERE ad.username = ? AND BINARY ad.password = ?', [req.query.username, req.query.password], (err, rows, _fields) => {
      if (err) {
        console.log(err);
        return res.status(500).send({ message: 'mysql error' });
      }
      if (rows.length === 1) {
        // success
        JSON.stringify(rows);
        return res.status(200).send({
          message: 'success',
          data: rows
        });
      }
      if (rows.length === 0) {
        return res.status(404).send({ message: 'Login failed' });
      }
      console.log(`error - records returned is ${rows.length}`);
      return res.status(501).send({ message: 'records returned is not 1' });
    });
  });

  /**
     * @api {get} /GetAllAgentRecs Gets a dump of all Agent Records in the database.
     * @apiName Get All Agent Recs
     * @apiGroup GetAllAgentRecs
     * @apiVersion 1.0.0
     *
     * @apiSuccessExample 200 Success-Response
     *     HTTP/1.1 200 OK
     *    {
     *      "message":"success",
     *      "data":[{
     *             agent_id: 0,
     *             username: "CSRAgent0",
     *             first_name: "John",
     *             last_name: "Smith",
     *             phone: "1112223333",
     *             role:"Agent",
     *             email:"jsmith@email.xyz",
     *             organization:"call center xyz",
     *             is_approved: 1,
     *             is_active: 1,
     *             extension: 1234,
     *             extension_secret: "ABC123",
     *             queue_name: "Queue1234",
     *             queue_name: null
     *            },{
     *             ...
     *            }]
     *    }
     *
     * @apiSuccessExample 204 Success-Response
     *     HTTP/1.1 204 No Content
     *    {
     *      "message":"no agent records"
     *    }
     * @apiErrorExample 500 Error-Response
     *     HTTP/1.1 500 Internal Server Error
     *     {
     *        'message': 'mysql error'
     *     }
     */

  app.get('/getallagentrecs', (req, res) => {
    // Query DB for all agent records
    connection.query('SELECT ad.agent_id, ad.username, ad.first_name, ad.last_name, ad.role, ad.phone, ad.email, ad.organization, ad.is_approved, ad.is_active, ae.extension, ae.extension_secret, aq.queue_name, aq2.queue_name AS queue2_name, oc.channel FROM agent_data AS ad LEFT JOIN asterisk_extensions AS ae ON ad.extension_id = ae.id LEFT JOIN asterisk_queues AS aq ON aq.id = ad.queue_id LEFT JOIN asterisk_queues AS aq2 ON aq2.id = ad.queue2_id LEFT JOIN outgoing_channels AS oc ON oc.id = ae.id ORDER BY agent_id', (err, rows, _fields) => {
      if (err) {
        console.log(err);
        return res.status(500).send({
          message: 'mysql error'
        });
      }
      if (rows.length > 0) {
        // success
        JSON.stringify(rows);
        return res.status(200).send({
          message: 'success',
          data: rows
        });
      }
      return res.status(204).send({
        message: 'no agent records'
      });
    });
  });

  /**
     * @api {get} /GetAgentRec Gets a dump of a single Agent Record from the database.
     * @apiName Get Agent Rec
     * @apiGroup GetAgentRec
     * @apiVersion 1.0.0
     *
     * @apiSuccessExample 200 Success-Response
     *     HTTP/1.1 200 OK
     *    {
     *      "message":"success",
     *      "data":[{
     *             agent_id: 0,
     *             username: "CSRAgent0",
     *             first_name: "John",
     *             last_name: "Smith",
     *             phone: "1112223333",
     *             role:"Agent",
     *             email:"jsmith@email.xyz",
     *             organization:"call center xyz",
     *             is_approved: 1,
     *             is_active: 1,
     *             extension: 1234,
     *             extension_secret: "ABC123",
     *             queue_name: "Queue1234",
     *             queue_name: null
     *            }]
     *    }
     *
     * @apiSuccessExample 200 Success-Response
     *     HTTP/1.1 200 OK
     *    {
     *        "message": "no agent records",
     *        "data": ""
     *    }
     * @apiErrorExample 500 Error-Response
     *     HTTP/1.1 500 Internal Server Error
     *     {
     *        'message': 'mysql error'
     *     }
     */
  app.get('/getagentrec/:username', (req, res) => {
    // Query DB for an agent record
    connection.query('SELECT ad.agent_id, ad.username, ad.first_name, ad.last_name, ad.role, ad.phone, ad.email, ad.organization, ad.is_approved, ad.is_active, ae.extension, ae.extension_secret, aq.queue_name,  ad.layout, aq2.queue_name AS queue2_name, oc.channel FROM agent_data AS ad LEFT JOIN asterisk_extensions AS ae ON ad.extension_id = ae.id LEFT JOIN asterisk_queues AS aq ON aq.id = ad.queue_id LEFT JOIN asterisk_queues AS aq2 ON aq2.id = ad.queue2_id LEFT JOIN outgoing_channels AS oc ON oc.id = ae.id WHERE ad.username =  ?', [req.params.username], (err, rows, _fields) => {
      if (err) {
        console.log(err);
        return res.status(500).send({
          message: 'mysql error'
        });
      }
      if (rows.length > 0) {
        // success
        JSON.stringify(rows);
        return res.status(200).send({
          message: 'success',
          data: rows
        });
      }
      return res.status(200).send({
        message: 'no agent records',
        data: ''
      });
    });
  });

  /**
     * @api {get} /GetScript Gets a specify CSR Agent Script by queue name from the database.
     * @apiName GetScript
     * @apiGroup GetScript
     * @apiVersion 1.0.0
     *
     * @apiParam {String} queue_name   Queue name for associated with a script.
     *
     * @apiSuccessExample 200 Success-Response
     *     HTTP/1.1 200 OK
     *    {
     *      "message":"success",
     *      "data":[{
     *               "id": 0,
     *               "queue_name": "Complaints",
     *               "text": "The script text the agent will say to the caller.....",
     *               "date": '2016-04-01',
     *               "type": 'Complaint Script'
     *            }]
     *    }
     *
     * @apiErrorExample 400 Error-Response
     *     HTTP/1.1 400 BadRequest Bad Request Error
     *     {
     *        'message': 'missing queue_name field'
     *     }
     * @apiErrorExample 404 Not-Found-Response
     *     HTTP/1.1 404 Not Found
     *    {
     *      "message":"script not found"
     *    }
     * @apiErrorExample 500 Error-Response
     *     HTTP/1.1 500 Internal Server Error
     *     {
     *        'message': 'mysql error'
     *     }
     */

  app.get('/getscript', (req, res) => {
    if (!req.query.queue_name) {
      return res.status(400).send({
        message: 'missing queue_name field'
      });
    }

    // Query DB for script info
    return connection.query('SELECT s.id, aq.queue_name, s.text, s.date, s.type FROM scripts AS s, asterisk_queues AS aq WHERE s.queue_id = aq.id AND aq.queue_name = ?', [req.query.queue_name], (err, rows, _fields) => {
      if (err) {
        console.log(err);
        return res.status(500).send({
          message: 'mysql error'
        });
      }
      if (rows.length >= 1) {
        // success
        JSON.stringify(rows);
        return res.status(200).send({
          message: 'success',
          data: rows
        });
      }
      return res.status(404).send({
        message: 'script not found'
      });
    });
  });

  /**
     * @api {get} /GetAllScripts Gets a dump of all CSR Agent Scripts from the database.
     * @apiName GetAllScripts
     * @apiGroup GetAllScripts
     * @apiVersion 1.0.0
     *
     * @apiSuccessExample 200 Success-Response
     *     HTTP/1.1 200 OK
     *    {
     *      "message":"success",
     *      "data":[{
     *               "id": 0,
     *               "queue_name": "Complaints",
     *               "text": "The script text the agent will say to the caller.....",
     *               "date": '2016-04-01',
     *               "type": 'New Complaint Script'
     *            },{
     *               "id": 1,
     *               "queue_name": "Other",
     *               "text": "The script text the agent will say to the caller.....",
     *               "date": '2016-04-15',
     *               "type": 'Other Type'
     *           }]
     *    }
     *
     * @apiErrorExample 404 Not-Found-Response
     *     HTTP/1.1 404 Not Found
     *    {
     *      "message":"script not found"
     *    }
     * @apiErrorExample 500 Error-Response
     *     HTTP/1.1 500 Internal Server Error
     *     {
     *        'message': 'mysql error'
     *     }
     */

  app.get('/getallscripts', (req, res) => {
    // Query DB for script info
    connection.query('SELECT s.id, aq.queue_name, s.text, s.date, s.type FROM scripts AS s, asterisk_queues AS aq WHERE s.queue_id = aq.id', (err, rows, _fields) => {
      if (err) {
        console.log(err);
        return res.status(500).send({
          message: 'mysql error'
        });
      }
      if (rows.length >= 1) {
        // success
        JSON.stringify(rows);
        return res.status(200).send({
          message: 'success',
          data: rows
        });
      }
      return res.status(404).send({
        message: 'script not found'
      });
    });
  });

  /*
     * This is just for testing the connection, no APIdoc info required.
     * GET request; e.g. https://localhost:8085/
     */

  app.get('/', (req, res) => res.status(200).send({ message: 'Welcome to the agent portal.' }));

  /**
     * @api {post} /UpdateProfile Updates an Agent's information in the database.
     * @apiName Updates an Agent Record
     * @apiGroup UpdateProfile
     * @apiVersion 1.0.0
     *
     * @apiParam {String} agent_id CSR Agent ID Number from the Database
     * @apiParam {String} first_name First name of the CSR Agent user
     * @apiParam {String} last_name Last name of the CSR Agent user
     * @apiParam {String} role Role of the CSR Agent user
     * @apiParam {String} phone Phone number for the CSR Agent user
     * @apiParam {String} email Email address for the CSR Agent user
     * @apiParam {String} orgainization ORganization for the CSR Agent user
     * @apiParam {Boolean} is_approved A boolean value.
     * @apiParam {Boolean} is_active A boolean value.
     *
     * @apiSuccessExample Success-Response
     *     HTTP/1.1 200 OK
     *    {
     *      "message":"Success!"
     *    }
     * @apiErrorExample 400 Error-Response
     *     HTTP/1.1 400 BAD Request
     *     {
     *        'message': 'Missing required field(s)'
     *     }
     *
     * @apiErrorExample 500 Error-Response
     *     HTTP/1.1 500 Internal Server Error
     *     {
     *        'message': 'MySQL error'
     *     }
     */

  app.post('/updateProfile', (req, res) => {
    const agentId = req.body.agent_id;
    const firstName = req.body.first_name;
    const lastName = req.body.last_name;
    const { role } = req.body;
    const { phone } = req.body;
    const { email } = req.body;
    const { organization } = req.body;
    const isApproved = Boolean(req.body.is_approved);
    const isActive = Boolean(req.body.is_active);
    const { extension } = req.body;
    const queueId = req.body.queue_id;
    const queue2Id = req.body.queue2_id;

    if (!agentId || !firstName || !lastName || !role || !phone || !email || !organization
        || Number.isNaN(isApproved) || Number.isNaN(isActive) || Number.isNaN(extension)) {
      return res.status(400).send({
        message: 'Missing required field(s)'
      });
    }

    let extensionId = 'NULL';
    const extensionLookup = new Promise((resolve, reject) => {
      // translate extension into extension_id
      const extQuery = 'select a.id from asterisk_extensions AS a where a.extension=?';
      connection.query(extQuery, extension, (err, rows, _fields) => {
        if (err) {
          console.log(err);
          reject(new Error('Extension not in asterisk_extensions table'));
        } else if (rows.length > 0) {
          console.log(JSON.stringify(rows));
          extensionId = rows[0].id;
          console.log(`extension_id after query is: ${extensionId}`);
          resolve(extensionId);
        } else {
          console.log('extension not found in asterisk_extensions table');
          resolve(extensionId);
        }
      });
    });

    return extensionLookup.then((extensionIdParam) => {
      const query = 'UPDATE agent_data SET first_name = ?'
      + ', last_name = ?'
      + ', role = ?'
      + ', phone = ?'
      + ', email = ?'
      + ', organization = ?'
      + ', is_approved = ?'
      + ', is_active = ?'
      + ', extension_id = ?'
      + ', queue_id = ?'
      + ', queue2_id = ?'
      + ' WHERE agent_id = ?';

      // Query for all records sorted by the id
      connection.query(query, [firstName, lastName, role, phone, email, organization,
        isApproved, isActive, extensionIdParam, queueId, queue2Id, agentId], (err, results) => {
        if (err) {
          console.log(err);
          return res.status(500).send({
            message: 'MySQL error'
          });
        }
        if (results.affectedRows > 0) {
          return res.status(200).send({
            message: 'Success!'
          });
        }
        return res.status(200).send({
          message: 'Failed!'
        });
      });
    },
    (error) => res.status(200).send({ message: error }));
  });

  /**
     * @api {post} /addAgents ADDS agents to agent_data table. username and email must be unique
     * @apiName Adds agent_data records
     * @apiGroup AddAgents
     * @apiVersion 1.0.0
     *
     *
     * @apiSuccessExample Success-Response
     *     HTTP/1.1 200 OK
     *    {
     *      "message":"Success!"
     *    }
     * @apiErrorExample Error-Response
     *     HTTP/1.1 200 OK
     *    {
     *      "message":"Error messages..."
     *    }
     */
  /*
     Expected Input json:

     {
          "data": [{
              "username": "<insert username>",
              "password": "<insert password>",
              "first_name": "<insert fname>",
              "last_name": "<insert lname>",
              "role": "<insert role>",
              "phone": "<insert phone>",
              "email": "<insert email>",
              "organization": "<insert organization>",
              "is_approved": 0,
              "is_active": 0,
              "extension_id": 0,
              "queue_id": 0,
              "queue2_id": 0
          }, {
              "username": "<insert username>",
              "password": "<insert password>",
              "first_name": "<insert fname>",
              "last_name": "<insert lname>",
              "role": "<insert role>",
              "phone": "<insert phone>",
              "email": "<insert email>",
              "organization": "<insert organization>",
              "is_approved": 0,
              "is_active": 0,
              "extension_id": 0,
              "queue_id": 0,
              "queue2_id": 0
          },{
              "username": "<insert username>",
              "password": "<insert password>",
              "first_name": "<insert fname>",
              "last_name": "<insert lname>",
              "role": "<insert role>",
              "phone": "<insert phone>",
              "email": "<insert email>",
              "organization": "<insert organization>",
              "is_approved": 0,
              "is_active": 0,
              "extension_id": 0,
              "queue_id": 0,
              "queue2_id": 0
          }]
      }

     */
  app.post('/addAgents', (req, res) => {
    const agents = req.body.data;
    const sqlInsert = 'INSERT INTO agent_data (username, password, first_name, last_name, role, phone, email, organization, is_approved, is_active, extension_id, queue_id, queue2_id) VALUES ?;';
    const values = [];

    agents.forEach((rec) => {
      const { username } = rec;
      const { password } = rec;
      const firstName = rec.first_name;
      const lastName = rec.last_name;
      const { role } = rec;
      const { phone } = rec;
      const { email } = rec;
      const { organization } = rec;
      const isApproved = rec.is_approved || 0;
      const isActive = rec.is_active || 0;
      let extensionId = 'NULL';
      const queueId = rec.queue_id || 'NULL';
      const queue2Id = rec.queue2_id || 'NULL';

      const extensionLookup = new Promise(
        (resolve, reject) => {
          // translate extension into extension_id
          const extQuery = 'select a.id from asterisk_extensions AS a where a.extension=?';
          connection.query(extQuery, rec.extension_id, (err, rows, _fields) => {
            if (err) {
              console.log(err);
              reject(new Error('Extension not in asterisk_extensions table'));
            } else if (rows.length > 0) {
              console.log(JSON.stringify(rows));
              extensionId = rows[0].id;
              console.log(`extension_id after query is: ${extensionId}`);
              resolve(extensionId);
            } else {
              console.log('extension not found in asterisk_extensions table');
              resolve(extensionId);
            }
          });
        }
      );

      extensionLookup.then((extensionIdParam) => {
        values.push([username, password, firstName, lastName, role, phone, email,
          organization, isApproved, isActive, extensionIdParam, queueId, queue2Id]);

        console.log(`values used in sqlinsert: ${values}`);
        connection.query(sqlInsert, [values], (err, results) => {
          if (err) {
            // mysql error occurred
            res.status(200).send({
              status: 'Failure',
              message: 'mysql Error'
            });
          } else if (results.affectedRows === 0) {
            // no mysql error but insert failed
            res.status(200).send({
              status: 'Failure',
              message: 'No records created'
            });
          } else {
            // insert was successful
            res.status(200).send({
              status: 'Success',
              message: `${results.affectedRows} of ${values.length} records created.`
            });
          }
        });
      },
      (error) => {
        res.status(200).send({
          status: 'Failure',
          message: error
        });
      });
    });
  });

  /**
    /**
     * @api {post} /DeleteAgent Deletes an Agent's information in the database.
     * @apiName Delete an Agent Record
     * @apiGroup DeleteAgent
     * @apiVersion 1.0.0
     *
     * @apiParam {String} agent_id CSR Agent ID Number from the Database
     *
     * @apiSuccessExample Success-Response
     *     HTTP/1.1 200 OK
     *    {
     *      "message":"Success!"
     *    }
     * @apiErrorExample 400 Error-Response
     *     HTTP/1.1 400 BAD Request
     *     {
     *        'message': 'Missing required field(s)'
     *     }
     *
     * @apiErrorExample 500 Error-Response
     *     HTTP/1.1 500 Internal Server Error
     *     {
     *        'message': 'MySQL error'
     *     }
     */

  app.post('/DeleteAgent', (req, res) => {
    const agentId = req.body.agent_id;
    if (!agentId) {
      return res.status(400).send({
        message: 'Missing required field'
      });
    }

    const query = 'DELETE FROM agent_data WHERE agent_id = ?';
    return connection.query(query, agentId, (err, results) => {
      if (err) {
        console.log(err);
        return res.status(500).send({
          message: 'MySQL error'
        });
      }
      if (results.affectedRows > 0) {
        return res.status(200).send({
          message: 'Success!'
        });
      }
      return res.status(200).send({
        message: 'Failed!'
      });
    });
  });

  /**
     * @api {post} /updateLayoutConfig UPDATE layout, agent data table, size/loc of boxes agent page
     *
     * @apiName Update Layout Config
     * @apiGroup UpdateLayoutConfig
     * @apiVersion 1.0.0
     *
     * @apiParam {String} agent_id CSR Agent ID Number from the Database
     * @apiParam {JSON} layout Json layout configuration
     *
     * @apiSuccessExample Success-Response
     *     HTTP/1.1 200 OK
     *    {
     *      "message":"Success!"
     *    }
     * @apiErrorExample 400 Error-Response
     *     HTTP/1.1 400 BAD Request
     *     {
     *        'message': 'Missing Parameters'
     *     }
     *
     * @apiErrorExample 500 Error-Response
     *     HTTP/1.1 500 Internal Server Error
     *     {
     *        'message': 'MySQL error'
     *     }
     */

  app.post('/updateLayoutConfig', (req, res) => {
    const layout = JSON.stringify(req.body.layout);
    const agentId = req.body.agent_id;
    const query = 'UPDATE agent_data SET layout = ? WHERE agent_id = ?';

    if (layout && agentId) {
      connection.query(query, [layout, agentId], (err, results) => {
        if (err) {
          console.log(err);
          return res.status(500).send({
            message: 'MySQL error'
          });
        }
        if (results.affectedRows > 0) {
          return res.status(200).send({
            message: 'Success!'
          });
        }
        return res.status(200).send({
          message: 'Failed!'
        });
      });
    } else {
      res.status(400).send({
        message: 'Missing Parameters'
      });
    }
  });

  app.get('/operatinghours', (req, res) => {
    const today = new Date();
    const tenDigit = (today.getUTCMinutes() < 10 ? '0' : '');

    let currentTime = parseFloat(`${today.getUTCHours()}.${tenDigit}${today.getUTCMinutes()}`);
    const responseJson = {
      current: today
    };
    const sqlQuery = 'SELECT id, start, end, business_mode FROM asterisk_operating_status WHERE id = 1;';

    connection.query(sqlQuery, (err, result) => {
      if (err) {
        res.status(200).send({
          status: 'Failure',
          message: 'mysql Error'
        });
      } else {
        const startTime = result[0].start;
        const endTime = result[0].end;
        let businessMode = result[0].business_mode || 0;

        responseJson.status = 'Success';
        responseJson.message = 'Server responding with Start and End times.';
        responseJson.start = startTime;
        responseJson.end = endTime;
        responseJson.business_mode = businessMode;

        let start = parseFloat(startTime.replace(':', '.'));
        let end = parseFloat(endTime.replace(':', '.'));

        start = Number(start);
        end = Number(end);
        currentTime = Number(currentTime);
        businessMode = Number(businessMode);

        if (start > end) {
          // we pass midnight (00:00) during operating hours
          // if currentTime is between midnight and end, then add 24 to it
          if (currentTime >= 0 && currentTime <= end) {
            currentTime += 24.0;
          }
          end += 24.0;
        }

        /*
               * business mode 0 = use hours of operation
               * business mode 1 = Always Open
               * business mode 2 = Always Closed
              */
        responseJson.isOpen = false;
        if (businessMode === 1) {
          responseJson.isOpen = true;
        } else if (businessMode === 0) {
          if (currentTime >= start && currentTime < end) {
            responseJson.isOpen = true;
          }
        }
        res.status(200).send(responseJson);
      }
    });
  });

  app.post('/OperatingHours', (req, res) => {
    const { start } = req.body;
    const { end } = req.body;
    const businessMode = req.body.business_mode || 0;
    if (start && end) {
      const sqlQuery = 'INSERT INTO asterisk_operating_status (id, start, end, business_mode) '
                + ' VALUES (1, ?, ?, ?) '
                + ' ON DUPLICATE KEY UPDATE '
                + ' start=VALUES(start), '
                + ' end=VALUES(end), '
                + ' business_mode=VALUES(business_mode);';

      connection.query(sqlQuery, [start, end, businessMode], (err, _result) => {
        if (err) {
          res.status(200).send({
            status: 'Failure',
            message: 'mysql Error'
          });
        } else {
          asterisk.action({
            Action: 'DBPut',
            family: 'BUSINESS_HOURS',
            key: 'START',
            val: start

          }, (_err, _res) => {});

          asterisk.action({
            Action: 'DBPut',
            family: 'BUSINESS_HOURS',
            key: 'END',
            val: end

          }, (_err, _res) => {});

          asterisk.action({
            Action: 'DBPut',
            family: 'BUSINESS_HOURS',
            key: 'ACTIVE',
            val: businessMode

          }, (_err, _res) => {});

          res.status(200).send({
            status: 'Success'
          });
        }
      });
    } else {
      res.status(400).send({
        status: 'Failure',
        message: 'Missing Parameters'
      });
    }
  });

  app.post('/UploadVideomail', (req, res) => {
    console.log('UPLOAD VIDEOMAIL');
    const { ext } = req.body;
    const { phoneNumber } = req.body;
    const { duration } = req.body;
    const { channel } = req.body;
    const { uniqueid } = req.body;
    const { filename } = req.body;

    const query = `INSERT INTO videomail
                     (extension, callbacknumber, recording_agent, 
                     processing_agent, received, processed, video_duration, 
                     status, deleted, src_channel, dest_channel, unique_id, 
                     video_filename, video_filepath)
                     VALUES (?,?,'kms_agent',null, NOW(), null, ?, 'UNREAD',0,null,?,?,?,?);`;

    const params = [ext, phoneNumber, duration, channel, uniqueid, filename, 's3'];
    connection.query(query, params, (err, results) => {
      if (err) {
        console.log(err);
        res.status(500).send({
          message: 'MySQL error'
        });
      } else if (results.affectedRows > 0) {
        res.status(200).send({
          message: 'Success!'
        });
      } else {
        res.status(200).send({
          message: 'Failed!'
        });
      }
    });
  });
};

module.exports = appRouter;
