/**
* Defines the different RESTful web services that can be called.
*
* @param (type) app Instance of express
* @param (type) connection Retrieves DB from the MySQL server
* @returns (undefined) Not used
*/

var appRouter = function(app,connection,itrsMode) {


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
  app.get('/vrsverify', function(req, res) {
    console.log('itrsMode is: ' + itrsMode);
    if (!req.query.vrsnum) {
      return res.status(400).send({'message': 'missing video phone number'});
    } else {
      if (itrsMode === "false") {
        //VERIFYING vrs num using our own database
        console.log('VERIFYING vrs num using our own database...');
        //Query DB for vrs number
        connection.query('SELECT * FROM user_data WHERE vrs = ?',req.query.vrsnum , function(err, rows, fields) {
          if (err) {
            console.log(err);
            return res.status(500).send({'message': 'mysql error', 'itrs_mode':itrsMode});
          } else if (rows.length === 1) {
            //success
            json = JSON.stringify(rows);
            rows[0]["sipuri"] = "itrsmodefalse";
	    res.status(200).send({'message': 'success', 'data':rows, 'itrs_mode':itrsMode});
          } else if (rows.length === 0) {
            return res.status(404).send({'message': 'Videophone number not found', 'itrs_mode':itrsMode});
          } else {
            console.log('error - records returned is ' + rows.length);
            return res.status(501).send({'message': 'records returned is not 1'});
          }
        });
      } else {
        //verify vrs num using the ITRS service
        console.log('VERIFYING vrs num using the ITRS service...');
        const exec = require('child_process').exec;
        var yourscript = exec('sh ../scripts/itrslookup.sh ' + req.query.vrsnum  + ' simple',
        (error, stdout, stderr) => {
          if (error !== null) {
            console.log('ERROR during itrslookup.sh; exec error: ' + error);
            console.log('Returning failure for ITRS lookup....');
            return res.status(404).send({'message': 'Videophone number not found', 'itrs_mode':itrsMode});
          }
          var arr = stdout.split(" ");
          var rsp = "";
          if (arr.length == 4 && arr[2] === 'sipuri' && arr[3].trim().length > 0) {
            //VERIFY SUCCESS
            console.log('ITRS VERIFIED ' + req.query.vrsnum + ' ? ... YES!');
            res.status(200).send({"message":"success","data":[{"vrs":req.query.vrsnum,"username":"","password":"","first_name":"","last_name":"","address":"","city":"","state":"","zip_code":"","email":"","isAdmin":0,"sipuri":arr[3].trim()}],"itrs_mode":"true"});
          } else {
            //ITRS VERIFY FAIL
            console.log('ITRS VERIFIED ' + req.query.vrsnum + ' ? ... NO!');
            return res.status(404).send({'message': 'Videophone number not found', 'itrs_mode':itrsMode});
          }
        });
      }
    }
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

  app.get('/getallvrsrecs', function(req, res) {
    //Query DB for vrs number
    connection.query('SELECT * FROM user_data ORDER BY vrs', function(err, rows, fields) {
      if (err) {
        console.log(err);
        return res.status(500).send({'message': 'mysql error'});
      } else if (rows.length > 0) {
        //success
        json = JSON.stringify(rows);
        res.status(200).send({'message': 'success', 'data':rows});
      } else if (rows.length === 0) {
        return res.status(204).send({'message': 'no video phone records'});
      }
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
    //e.g. https://host:nnnn/getuserinfo?username=someusername
    app.get('/getuserinfo', function(req, res) {
    //get user info for a single user; do not send username or password back
    if (!req.query.username) {
      return res.status(400).send({'message': 'missing username'});
    }
    connection.query('select vrs,first_name,last_name,address,city,state,zip_code,email,isAdmin from user_data where username = ?', req.query.username, function(err, rows, fields) {
        if (err) {
            console.log(err);
            return res.status(500).send({'message': 'mysql error'});
        } else if (rows.length > 0) {
            //success
            json = JSON.stringify(rows);
            res.status(200).send({'message': 'success', 'data':rows});
        } else if (rows.length === 0) {
            return res.status(200).send({'message': 'record not found'});
        }
    });
    });

  /**
  * Get to show server is running. This will not show if APIDoc is run.
  */
  app.get('/', function(req, res) {
    return res.status(200).send({'message': 'Welcome to the Videophone verification portal.'});
  });

  /**
* @api {put} /AddVRSRec Adds a VRS Record to the database.
* @apiName Add VRS Rec
* @apiGroup AddVRSRec
* @apiVersion 1.0.0
*
* @apiParam {String} vrs VRS phone number for the user
*	@apiParam {String} username username associated with the user account
*	@apiParam {String} password password associated with the user account
*	@apiParam {String} first_name First name of the VRS user
*	@apiParam {String} last_name Last name of the VRS user
*	@apiParam {String} address Address of the VRS user
*	@apiParam {String} city City of the VRS user
*	@apiParam {String} state State of the VRS user
*	@apiParam {String} zip_code Zip Code for the VRS user
*	@apiParam {String} email Email address for the VRS user
*	@apiParam {Boolean} isAdmin A boolean value. 0 is non-Admin, 1 Admin. Default is 0
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

	app.put('/addVrsRec',function(req, res) {
		console.log('Got a PUT request at /addVrsRec');
		var vrs = req.body.vrs
    var username = req.body.username;
		var password = req.body.password;
		var first_name = req.body.first_name;
		var last_name = req.body.last_name;
		var address = req.body.address;
		var city = req.body.city;
		var state = req.body.state;
		var zip_code = req.body.zip_code;
		var email = req.body.email;
		var isAdmin = Boolean(req.body.isAdmin);

		if (!vrs || !username || !password || !first_name || !last_name || !address || !city || !state || !zip_code || !email || isNaN(isAdmin)) {
			return res.status(400).send({'message': 'Missing required field(s)'});
		} else{
			var query = 'INSERT INTO user_data (vrs, username, password, first_name, last_name, address, city, state, zip_code, email, isAdmin) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
			// inserts new user_data record into database
			connection.query(query, [vrs, username, password, first_name,last_name, address, city, state, zip_code, email, isAdmin], function(err) {
				if (err) {
					console.log(err);
					return res.status(500).send({'message': 'MySQL error'});
				}
				else {
					return res.status(200).send({'message': 'Success!'});
				}
			});
		}
	});

  /**
* @api {post} /UpdateVRSRec Updates a VRS Record to the database.
* @apiName Updates a VRS Rec
* @apiGroup UpdateVRSRec
* @apiVersion 1.0.0
*
* @apiParam {String} vrs VRS phone number for the user
*	@apiParam {String} username username associated with the user account
*	@apiParam {String} password password associated with the user account
*	@apiParam {String} first_name First name of the VRS user
*	@apiParam {String} last_name Last name of the VRS user
*	@apiParam {String} address Address of the VRS user
*	@apiParam {String} city City of the VRS user
*	@apiParam {String} state State of the VRS user
*	@apiParam {String} zip_code Zip Code for the VRS user
*	@apiParam {String} email Email address for the VRS user
*	@apiParam {Boolean} isAdmin A boolean value. 0 is non-Admin, 1 Admin. Default is 0
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

	app.post('/updateVrsRec',function(req, res) {
		console.log('Got a POST request at /updateVrsRec');
		var vrs = req.body.vrs;
		var password = req.body.password;
		var first_name = req.body.first_name;
		var last_name = req.body.last_name;
		var address = req.body.address;
		var city = req.body.city;
		var state = req.body.state;
		var zip_code = req.body.zip_code;
		var isAdmin = Boolean(req.body.isAdmin);

		if (!vrs || !password || !first_name || !last_name || !address || !city || !state || !zip_code || isNaN(isAdmin)) {
			return res.status(400).send({'message': 'Missing required field(s)'});
		} else {
			var query = 'UPDATE user_data SET password = ?, first_name = ?, last_name = ?, address = ?, city = ?, state = ?, zip_code = ?, isAdmin = ? WHERE vrs = ?';
			//console.log(query);
			// Update user data
			connection.query(query, [password, first_name, last_name, address, city, state, zip_code, isAdmin, vrs], function(err) {
				if (err) {
					console.log(err);
					return res.status(500).send({'message': 'MySQL error'});
				}
				else {
					return res.status(200).send({'message': 'Success!'});
				}
			});
		}
  });
  
  //For fileshare
  app.post('/storeFileInfo', function(req, res){
    let vrs = req.body.vrs;
    let originalFileName = req.body.originalFilename;
    let filePath = req.body.filepath;
    let fileName = req.body.filename;
    let mimetype = req.body.mimetype;
    //TODO Insert into database
    var query = 'INSERT INTO file_uploads (vrs, original_filename, filename, filepath, mimetype) VALUES (?,?,?,?,?)';
    var params = [vrs, originalFileName, fileName, filePath, mimetype];
    console.log("Param is " + params);
    connection.query(query, params, function(err, result){
      if(err){
        return res.status(500).send({'message': 'MySQL error'});
      }
      else {
        return res.status(200).send({'message': 'Success!'});
      }
    });
  })

  app.get('/storeFileInfo', function(req, res){
    console.log('About to return' + req.query.documentID);
    var query = 'SELECT original_filename, filepath FROM file_uploads WHERE pk_file_id=?;';
    var params = [req.query.documentID];
    console.log("Param is " + params);
    connection.query(query, params, function(err, result){
      if(err || result.length < 1){
        return res.status(500).send({'message': 'MySQL error'});
      }
      else {
        return res.status(200).send({
          'message': 'Success', 
          'filename' : result[0].original_filename, 
          'filepath' : result[0].filepath
        });
      }
    });
  })  

  app.get('/fileListByVRS', function(req, res){
    var query = 'SELECT original_filename, pk_file_id AS id FROM file_uploads WHERE vrs=?;';
    var params = [req.query.vrs];
    console.log("Param is " + params);
    connection.query(query, params, function(err, result){
      if(err){
        return res.status(500).send({'message': 'MySQL error'});
      }
      else {
        return res.status(200).send({
          'message': 'Success', 
          'result' : result
        });
      }
    });
  }) 

};

module.exports = appRouter;
