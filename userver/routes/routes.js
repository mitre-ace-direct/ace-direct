/**
* Defines the different RESTful web services that can be called.
*
* @param (type) app Instance of express
* @param (type) connection Retrieves DB from the MySQL server
* @returns (undefined) Not used
*/

const execObj = require('child_process');

const appRouter = (app, connection, itrsMode) => {
  /**
* @api {get} /vrsverify Get VRS record for a vrs number.
* @apiName VRS Verify
* @apiGroup VRSVerify
* @apiVersion 1.0.0
*
* @apiParam {String} vrsnum   vrs phone number to look up.
*
* @apiSuccessExample Success-Response
*     HTTP/1.1 200 OK
*    {
*      "message":"success",
*      "data":[
*           {
*              "vrs":"1112223333",
*              "username":"user1",
*              "first_name":"john",
*              "last_name":"smith",
*              "address":"123 main street",
*              "city":"Springfield",
*              "state":"NJ",
*              "zip_code":"01234",
*              "email":"jsmith@email.xyz",
*              "isAdmin":0
*            }]
*    }
* @apiErrorExample 400 Error-Response
*     HTTP/1.1 400 BadRequest Bad Request Error
*     {
*        'message': 'missing vrsnum'
*     }
* @apiErrorExample 404 Error-Response
*     HTTP/1.1 404 Not Found
*     {
*        'message': 'vrs number not found'
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
  app.get('/vrsverify', (req, res) => {
    console.log(`itrsMode is: ${itrsMode}`);
    if (!req.query.vrsnum) {
      return res.status(400).send({ message: 'missing video phone number' });
    }

    if (itrsMode === 'false') {
      // VERIFYING vrs num using our own database
      console.log('VERIFYING vrs num using our own database...');
      // Query DB for vrs number
      return connection.query('SELECT * FROM user_data WHERE vrs = ?', req.query.vrsnum, (err, rowsParam, _fields) => {
        let rows = null;
        if (err) {
          console.log(err);
          return res.status(500).send({ message: 'mysql error', itrs_mode: itrsMode });
        }
        rows = rowsParam;
        if (rows.length === 1) {
          // success
          JSON.stringify(rows);
          rows[0].sipuri = 'itrsmodefalse';
          return res.status(200).send({ message: 'success', data: rows, itrs_mode: itrsMode });
        }
        if (rows.length === 0) {
          return res.status(404).send({ message: 'Videophone number not found', itrs_mode: itrsMode });
        }
        console.log(`error - records returned is ${rows.length}`);
        return res.status(501).send({ message: 'records returned is not 1' });
      });
    }

    // verify vrs num using the ITRS service
    console.log('VERIFYING vrs num using the ITRS service...');
    const { exec } = execObj;
    return exec(`sh ../scripts/itrslookup.sh ${req.query.vrsnum} simple`,
      (error, stdout, _stderr) => {
        if (error !== null) {
          console.log(`ERROR during itrslookup.sh; exec error: ${error}`);
          console.log('Returning failure for ITRS lookup....');
          return res.status(404).send({ message: 'Videophone number not found', itrs_mode: itrsMode });
        }
        const arr = stdout.split(' ');
        if (arr.length === 4 && arr[2] === 'sipuri' && arr[3].trim().length > 0) {
          // VERIFY SUCCESS
          console.log(`ITRS VERIFIED ${req.query.vrsnum} ? ... YES!`);
          const obj = {
            message: 'success',
            data: [
              {
                vrs: parseInt(req.query.vrsnum, 10), username: '', password: '', first_name: '', last_name: '', address: '', city: '', state: '', zip_code: '', email: '', isAdmin: 0, sipuri: arr[3].trim()
              }],
            itrs_mode: 'true'
          };
          return res.status(200).send(obj);
        }
        // ITRS VERIFY FAIL
        console.log(`ITRS VERIFIED ${req.query.vrsnum} ? ... NO!`);
        return res.status(404).send({ message: 'Videophone number not found', itrs_mode: itrsMode });
      });
  });

  /**
* @api {get} /GetAllVRSRecs Gets a dump of all VRS Records in the database.
* @apiName Get All VRS Recs
* @apiGroup GetAllVRSRecs
* @apiVersion 1.0.0
*
* @apiSuccessExample 200 Success-Response
*     HTTP/1.1 200 OK
*    {
*      "message":"success",
*      "data":[
*           {
*              "vrs":"1112223333",
*              "username":"user1",
*              "first_name":"john",
*              "last_name":"smith",
*              "address":"123 main street",
*              "city":"Springfield",
*              "state":"NJ",
*              "zip_code":"01234",
*              "email":"jsmith@email.xyz",
*              "isAdmin":0
*            },{
*             ...
*            }]
*    }
*
* @apiSuccessExample 204 Success-Response
*     HTTP/1.1 204 No Content
*    {
*      "message":"no vrs records"
*    }
* @apiErrorExample 500 Error-Response
*     HTTP/1.1 500 Internal Server Error
*     {
*        'message': 'mysql error'
*     }
*/

  app.get('/getallvrsrecs', (req, res) => {
    // Query DB for vrs number
    connection.query('SELECT * FROM user_data ORDER BY vrs', (err, rows, _fields) => {
      if (err) {
        console.log(err);
        return res.status(500).send({ message: 'mysql error' });
      }
      if (rows.length > 0) {
        // success
        JSON.stringify(rows);
        return res.status(200).send({ message: 'success', data: rows });
      }
      return res.status(204).send({ message: 'no video phone records' });
    });
  });

  /**
    * @api {get} /getuserinfo Gets user info (minus username and password) for a given username
    * @apiName Get User Info
    * @apiGroup GetUserInfo
    * @apiVersion 1.0.0
    *
    * @apiSuccessExample 200 Success-Response
    *     HTTP/1.1 200 OK
    *   {
    *     "message": "success",
    *     "data": [
    *       {
    *         "vrs": 0,
    *         "first_name": "First",
    *         "last_name": "Last",
    *         "address": "1 Some Street",
    *         "city": "Some City",
    *         "state": "XX",
    *         "zip_code": "00000",
    *         "email": "someuser@mail.com",
    *         "isAdmin": 0
    *       }
    *     ]
    *   }
    *
    * @apiSuccessExample 200 Success-Response
    *     HTTP/1.1 200 OK
    *   {
    *     "message": "record not found"
    *   }
    *
    * @apiSuccessExample 400 Error-Response
    *     HTTP/1.1 400 Bad Request
    *   {
    *     "message": "missing username"
    *   }
    *
    * @apiErrorExample 500 Error-Response
    *     HTTP/1.1 500 Internal Server Error
    *     {
    *        "message": "mysql error"
    *     }
    */

  // e.g. https://host:nnnn/getuserinfo?username=someusername
  app.get('/getuserinfo', (req, res) => {
    // get user info for a single user; do not send username or password back
    if (!req.query.username) {
      return res.status(400).send({ message: 'missing username' });
    }
    return connection.query('select vrs,first_name,last_name,address,city,state,zip_code,email,isAdmin from user_data where username = ?', req.query.username, (err, rows, _fields) => {
      if (err) {
        console.log(err);
        return res.status(500).send({ message: 'mysql error' });
      }
      if (rows.length > 0) {
        // success
        JSON.stringify(rows);
        return res.status(200).send({ message: 'success', data: rows });
      }
      return res.status(200).send({ message: 'record not found' });
    });
  });

  /**
  * Get to show server is running. This will not show if APIDoc is run.
  */
  app.get('/', (req, res) => res.status(200).send({ message: 'Welcome to the Videophone verification portal.' }));

  /**
* @api {put} /AddVRSRec Adds a VRS Record to the database.
* @apiName Add VRS Rec
* @apiGroup AddVRSRec
* @apiVersion 1.0.0
*
* @apiParam {String} vrs VRS phone number for the user
*  @apiParam {String} username username associated with the user account
*  @apiParam {String} password password associated with the user account
*  @apiParam {String} first_name First name of the VRS user
*  @apiParam {String} last_name Last name of the VRS user
*  @apiParam {String} address Address of the VRS user
*  @apiParam {String} city City of the VRS user
*  @apiParam {String} state State of the VRS user
*  @apiParam {String} zip_code Zip Code for the VRS user
*  @apiParam {String} email Email address for the VRS user
*  @apiParam {Boolean} isAdmin A boolean value. 0 is non-Admin, 1 Admin. Default is 0
*
* @apiSuccessExample Success-Response
*     HTTP/1.1 200 OK
*    {
*      "message":"Success!"
*    }
*
* @apiErrorExample 500 Error-Response
*     HTTP/1.1 500 Internal Server Error
*     {
*        'message': 'mysql error'
*     }
*/

  app.put('/addVrsRec', (req, res) => {
    console.log('Got a PUT request at /addVrsRec');
    const { vrs } = req.body;
    const { username } = req.body;
    const { password } = req.body;
    const { firstName } = req.body;
    const { lastName } = req.body;
    const { address } = req.body;
    const { city } = req.body;
    const { state } = req.body;
    const { zipCode } = req.body;
    const { email } = req.body.email;
    const isAdmin = Boolean(req.body.isAdmin);

    if (!vrs || !username || !password || !firstName || !lastName
      || !address || !city || !state || !zipCode || !email || Number.isNaN(isAdmin)) {
      return res.status(400).send({ message: 'Missing required field(s)' });
    }
    const query = 'INSERT INTO user_data (vrs, username, password, first_name, last_name, address, city, state, zip_code, email, isAdmin) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
    // inserts new user_data record into database
    return connection.query(query, [vrs, username, password, firstName, lastName,
      address, city, state, zipCode, email, isAdmin], (err) => {
      if (err) {
        console.log(err);
        return res.status(500).send({ message: 'MySQL error' });
      }
      return res.status(200).send({ message: 'Success!' });
    });
  });

  /**
* @api {post} /UpdateVRSRec Updates a VRS Record to the database.
* @apiName Updates a VRS Rec
* @apiGroup UpdateVRSRec
* @apiVersion 1.0.0
*
* @apiParam {String} vrs VRS phone number for the user
*  @apiParam {String} username username associated with the user account
*  @apiParam {String} password password associated with the user account
*  @apiParam {String} first_name First name of the VRS user
*  @apiParam {String} last_name Last name of the VRS user
*  @apiParam {String} address Address of the VRS user
*  @apiParam {String} city City of the VRS user
*  @apiParam {String} state State of the VRS user
*  @apiParam {String} zip_code Zip Code for the VRS user
*  @apiParam {String} email Email address for the VRS user
*  @apiParam {Boolean} isAdmin A boolean value. 0 is non-Admin, 1 Admin. Default is 0
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
*        'message': 'mysql error'
*     }
*/

  app.post('/updateVrsRec', (req, res) => {
    console.log('Got a POST request at /updateVrsRec');
    const { vrs } = req.body;
    const { password } = req.body;
    const { firstName } = req.body;
    const { lastName } = req.body;
    const { address } = req.body;
    const { city } = req.body;
    const { state } = req.body;
    const { zipCode } = req.body;
    const isAdmin = Boolean(req.body.isAdmin);

    if (!vrs || !password || !firstName || !lastName
      || !address || !city || !state || !zipCode || Number.isNaN(isAdmin)) {
      return res.status(400).send({ message: 'Missing required field(s)' });
    }

    const query = 'UPDATE user_data SET password = ?, first_name = ?, last_name = ?, address = ?, city = ?, state = ?, zip_code = ?, isAdmin = ? WHERE vrs = ?';
    // Update user data
    return connection.query(query, [password, firstName, lastName, address, city,
      state, zipCode, isAdmin, vrs], (err) => {
      if (err) {
        console.log(err);
        return res.status(500).send({ message: 'MySQL error' });
      }
      return res.status(200).send({ message: 'Success!' });
    });
  });

  // For fileshare
  app.post('/storeFileInfo', (req, res) => {
    const { vrs } = req.body;
    const originalFileName = req.body.originalFilename;
    const filePath = req.body.filepath;
    const fileName = req.body.filename;
    const { mimetype } = req.body;
    // TODO Insert into database
    const query = 'INSERT INTO file_uploads (vrs, original_filename, filename, filepath, mimetype) VALUES (?,?,?,?,?)';
    const params = [vrs, originalFileName, fileName, filePath, mimetype];
    console.log(`Param is ${params}`);
    connection.query(query, params, (err, _result) => {
      if (err) {
        return res.status(500).send({ message: 'MySQL error' });
      }
      return res.status(200).send({ message: 'Success!' });
    });
  });

  app.get('/storeFileInfo', (req, res) => {
    console.log(`About to return ${req.query.documentID}`);
    const query = 'SELECT original_filename, filepath FROM file_uploads WHERE pk_file_id=?;';
    const params = [req.query.documentID];
    console.log(`Param is ${params}`);
    connection.query(query, params, (err, result) => {
      if (err || result.length < 1) {
        return res.status(500).send({ message: 'MySQL error' });
      }
      return res.status(200).send({
        message: 'Success',
        filename: result[0].original_filename,
        filepath: result[0].filepath
      });
    });
  });

  app.get('/fileListByVRS', (req, res) => {
    const query = 'SELECT original_filename, pk_file_id AS id FROM file_uploads WHERE vrs=?;';
    const params = [req.query.vrs];
    console.log(`Param is ${params}`);
    connection.query(query, params, (err, result) => {
      if (err) {
        return res.status(500).send({ message: 'MySQL error' });
      }
      return res.status(200).send({
        message: 'Success',
        result
      });
    });
  });
};

module.exports = appRouter;
