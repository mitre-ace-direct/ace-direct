var express = require('express');
var router = express.Router();
var request = require('request');
const jwt = require('jsonwebtoken');
const shortid = require('shortid');
const AWS = require('aws-sdk');
const proxy = require('proxy-agent');
const fs = require('fs');
var utils = require('./utils.js')
var c = require('./constants.js')
var config = require('./../../dat/config.json');
const path = require('path');
const formidable = require('formidable');

const fileSharingEnabled = (utils.getConfigVal(config.filesharing.enabled) === 'true') ? true : false;

AWS.config.update({
    region: utils.getConfigVal(config.s3.region),
    httpOptions: {
        agent: proxy(utils.getConfigVal(config.common.proxy))
    }
});
const s3 = new AWS.S3();

function agentRestrict(req, res, next) {
    if (req.session.isLoggedIn && req.session.user.role === "AD Agent") {
        next()
    } else {
        res.redirect(utils.getConfigVal(config.nginx.fognito_path));
    }
};

function consumerRestrict(req, res, next) {
    if (req.session.user && req.session.user.role === 'VRS' ) {
        next()
    } else {
        res.redirect('.'+utils.getConfigVal(config.nginx.consumer_route));
    }
};

function restrict(req, res, next) {
    if (req.session.user && req.session.user.role) {
        next()
    } else {
        res.redirect('./');
    }
};


const getAgent = (usnm) => {
    return new Promise((resolve, reject) => {
      console.log('Getting agent! Username: ', usnm)
      console.log('get agent link', `https://${config.servers.main_private_ip}:${config.app_ports.mserver}/getagentrec/${usnm}`)
      request({
        method: 'GET',
        headers : {'Accept': 'application/json'},
        url: `https://${config.servers.main_private_ip}:${config.app_ports.mserver}/getagentrec/${usnm}`,
      }, function (error, response, data) {
        if (error) {
          console.log("Error! Could not get agent:", error);
          reject(error)
        } else {
          console.log("Success! Agent found!");
          console.log('Data: ', typeof data)
          console.log("TEXT " + JSON.parse(data));
          if(data.length > 0) {
            var jsonData = JSON.parse(data)
            resolve(jsonData)
          }
          else reject("Agent cannot be found!")
        }
      });
    });
  }

router.get('/',  (req, res, next) => {
    res.redirect("."+utils.getConfigVal(config.nginx.consumer_route))
});

router.get(utils.getConfigVal(config.nginx.consumer_route), (req, res, next) => {
    if (req.session.user && req.session.user.role === 'VRS') {
       
        let please_wait_video = 'sample.mp4'; // TODO: Update with real default video
        let instructions_video = 'sample.mp4'; // TODO: Update with real default video
        let no_agents_video = 'sample.mp4'; // TODO: Update with the real default video
        
        if (config.complaint_videos && config.complaint_videos.please_wait_video) {
            please_wait_video = utils.getConfigVal(config.complaint_videos.please_wait_video);
            if (!please_wait_video || please_wait_video.length === 0) {
                please_wait_video = config.complaint_videos.please_wait_video;
            }
        }
        if (config.complaint_videos && config.complaint_videos.instructions_video) {
            instructions_video = utils.getConfigVal(config.complaint_videos.instructions_video);
            if (!instructions_video || instructions_video.length === 0) {
                instructions_video = config.complaint_videos.instructions_video;
            }
        }
        if (config.complaint_videos && config.complaint_videos.no_agents_video) {
            no_agents_video = utils.getConfigVal(config.complaint_videos.no_agents_video);
            if (!no_agents_video || no_agents_video.length === 0) {
                no_agents_video = config.complaint_videos.no_agents_video;
            }
        }
        res.render('dro/pages/complaint_form', {please_wait_video: please_wait_video, instructions_video: instructions_video, no_agents_video : no_agents_video});
    } else {
        //TODO This is the old path to the previous consumer portal
        //res.render('pages/complaint_login');
        res.render('dro/pages/complaint_login');
    }
});


/**
 * Checks to see if the number is blocked and, if it is not blocked,
 * calls the RESTful service to verify the VRS number.
 * If it is blocked, return 401 and send the FCC URL for the front end to redirect to.
 */
router.post('/consumer_login', (req, res) => {
    // All responses will be JSON sets response header.
    res.setHeader('Content-Type', 'application/json');
    const vrsnum = req.body.vrsnumber;
    if (/^\d+$/.test(vrsnum)) {
        req.dbConnection.query('SELECT reason FROM call_block WHERE vrs = ?;', vrsnum, (err, results) => {
            if (err || results.length > 0) {
                res.status(401).json({ message: 'Number blocked', redirectUrl: complaintRedirectUrl });
            } else {
                utils.getCallerInfo(vrsnum, (vrs) => {
                    if (vrs.message === 'success') {
                        req.session.user = {};
                        req.session.user.role = 'VRS';
                        req.session.user.vrs = vrs.data[0].vrs;
                        req.session.user.phone = vrs.data[0].vrs;
                        req.session.user.firstname = vrs.data[0].first_name;
                        req.session.user.lastname = vrs.data[0].last_name;
                        req.session.user.email = vrs.data[0].email;
                        res.status(200).json({
                            message: 'success'
                        });
                    } else {
                        res.status(200).json(vrs);
                    }
                });
            }
        });
    } else {
        console.log("bad vrs format?")
        res.status(200).json({
            message: 'Error: Phone number format incorrect'
        });
    }
});

router.get('/token', restrict, (req, res) => {
    if (req.session.user.role === 'VRS') {
        res.setHeader('Content-Type', 'application/json');
        const vrsnum = req.session.user.vrs;
        if (/^\d+$/.test(vrsnum)) {
            utils.getCallerInfo(vrsnum, (vrs) => {
                if (vrs.message === 'success') {
                    // add isOpen flag; notifies Consumers who try to connect after hours
                    vrs.data[0].isOpen = res.locals.isOpen;
                    // add start/end time; operating hours
                    vrs.data[0].startTimeUTC = res.locals.startTimeUTC; // hh:mm in UTC
                    vrs.data[0].endTimeUTC = res.locals.endTimeUTC; // hh:mm in UTC

                    const token = jwt.sign(vrs.data[0], utils.getConfigVal(config.web_security.json_web_token.secret_key), {
                        expiresIn: '2000'
                    });
                    res.status(200).json({
                        message: 'success',
                        token
                    });
                } else {
                    res.status(200).json(vrs);
                }
            });
        } else {
            res.status(200).json({
                message: 'Error: Phone number format incorrect'
            });
        }
    } else if (req.session.user.role === 'AD Agent') {
        const passphrase = shortid.generate();
        req.redisClient.set(passphrase, req.session.user.extensionPassword);
        req.redisClient.expire(passphrase, 5); // remove passphrase after 5 seconds.

        const payload = {};
        payload.agent_id = req.session.user.agent_id;
        payload.username = req.session.user.username;
        payload.first_name = req.session.user.firstname;
        payload.last_name = req.session.user.lastname;
        payload.role = req.session.user.role;
        payload.email = req.session.user.email;
        payload.phone = req.session.user.phone;
        payload.organization = req.session.user.organization;
        payload.queue_name = req.session.user.queue_name;
        payload.queue2_name = req.session.user.queue2_name;
        payload.extension = req.session.user.extension;
        payload.layout = req.session.user.layout;
        payload.lightcode = req.session.user.lightcode;
        payload.asteriskPublicHostname = req.session.user.asteriskPublicHostname;
        payload.stunServer = req.session.user.stunServer;
        payload.wsPort = req.session.user.wsPort;
        payload.signalingServerUrl = req.session.user.signalingServerUrl;
        payload.queuesComplaintNumber = req.session.user.queuesComplaintNumber;
        payload.extensionPassword = passphrase;

        payload.complaint_queue_count = 0; //complaintQueueCount;
        payload.general_queue_count = 0; //generalQueueCount;

        const queueList = {
            queue_name: payload.queue_name,
            queue2_name: payload.queue2_name
        };
        const agentInfo = {
            status: 'Away',
            username: payload.username,
            name: `${payload.first_name} ${payload.last_name}`,
            extension: payload.extension,
            queues: []
        };
        if (queueList.queue_name) {
            agentInfo.queues.push({
                queuename: queueList.queue_name
            });
        }
        if (queueList.queue2_name) {
            agentInfo.queues.push({
                queuename: queueList.queue2_name
            });
        }

        req.redisClient.hset(c.R_AGENT_INFO_MAP, payload.username, JSON.stringify(agentInfo));
        //sendAgentStatusList(payload.username, 'AWAY');

        const token = jwt.sign(payload, utils.getConfigVal(config.web_security.json_web_token.secret_key), {
            expiresIn: '2000'
        });
        res.status(200).json({
            message: 'success',
            token
        });
    } else {
        req.session.destroy((_err) => {
            res.redirect('');
        });
    }
});


/**
   * Handles a get request for login. Creates
   * valid session for authenticated users.
   *
   * @param {string} '/login'
   * @param {function} 'agent.shield(cookieShield)'
   * @param {function} function(req, res)
   */
router.get(utils.getConfigVal(config.nginx.agent_route), agentRestrict, (req, res, next) => {
    if (req.session.user.skipsetup) {
        next();
    } else {
        const username = req.session.user.username;
        utils.getUserInfo(username, (user) => {
            console.log("AGENT LOGIN " + JSON.stringify(user));
            if (user.message === 'success') {
                req.redisClient.hget(c.R_STATUS_MAP, user.data[0].username, (_err, status) => {
                    if (status !== null) {
                        res.render('pages/agent_duplicate_login', {
                            user: user.data[0].username
                        });
                        return
                    }
                    req.redisClient.hget(c.R_TOKEN_MAP, user.data[0].extension, (err, tokenMap) => {
                        tokenMap = JSON.parse(tokenMap);
                        const d = new Date();
                        const now = d.getTime();
                        // Delete Token if its older than 24 hours
                        if (tokenMap !== null && now > (tokenMap.date + 86400000)) {
                            req.redisClient.hdel(c.R_TOKEN_MAP, tokenMap.token);
                            tokenMap = {};
                        }
                        // Create new token if token didn't exist or expired
                        if (tokenMap === null || Object.keys(tokenMap).length === 0) {
                            const token = utils.createToken();
                            tokenMap = {
                                token,
                                date: now
                            };
                            req.redisClient.hset(c.R_TOKEN_MAP, user.data[0].extension, JSON.stringify(tokenMap));
                        }
                        const asteriskPublicHostname = utils.getConfigVal(config.servers.asterisk_fqdn);
                        const stunServer = `${utils.getConfigVal(config.servers.stun_fqdn)}:${utils.getConfigVal(config.app_ports.stun)}`;

                        let wsPort = utils.getConfigVal(config.app_ports.asterisk_ws);
                        if (wsPort !== '') {
                            wsPort = parseInt(wsPort, 10);
                        }

                        const extensionPassword = utils.getConfigVal(config.asterisk.extensions.secret);

                        req.redisClient.hset(c.R_TOKEN_MAP, tokenMap.token, 'AWAY');
                        // Adds user to statusMap.
                        // Tracks if user is already logged in elsewhere
                        req.redisClient.hset(c.R_STATUS_MAP, user.data[0].username, 'AWAY');
                        req.session.user.skipsetup = true;
                        req.session.user.organization = user.data[0].organization;
                        req.session.user.queue_name = user.data[0].queue_name;
                        req.session.user.queue2_name = user.data[0].queue2_name;
                        req.session.user.extension = user.data[0].extension;
                        req.session.user.layout = user.data[0].layout;
                        req.session.user.lightcode = tokenMap.token;
                        req.session.user.asteriskPublicHostname = asteriskPublicHostname;
                        req.session.user.stunServer = stunServer;
                        req.session.user.wsPort = wsPort;
                        req.session.user.signalingServerUrl = `${utils.getConfigVal(config.signaling_server.protocol)}://${utils.getConfigVal(config.servers.nginx_fqdn)}${utils.getConfigVal(config.signaling_server.path)}`;
                        req.session.user.queuesComplaintNumber = utils.getConfigVal(config.asterisk.queues.complaint.number); //why is this needed?
                        req.session.user.extensionPassword = extensionPassword;
                        req.session.user.complaint_queue_count = 0; // complaintQueueCount;
                        req.session.user.general_queue_count = 0; //generalQueueCount;
                        next();
                    });
                });
            } else {
                res.render('pages/agent_account_pending', {
                    user: username
                });
            }
        });
    }
});

/**
* Handles a GET request for /agent. Checks user has
* a valid session and displays page.
*
* @param {string} '/agent'
* @param {function} function(req, res)
*/
router.get(utils.getConfigVal(config.nginx.agent_route), agentRestrict, (req, res) => {
    res.render('pages/agent_home');
});

/**
 * Handles a GET request for /getVideoamil to retrieve the videomail file
 * @param {string} '/getVideomail'
 * @param {function} function(req, res)
 */

router.get('/getVideomail', agentRestrict, (req, res) => {
    const videoId = req.query.id;
    const agentExt = req.session.user.extension;
    // Wrap in mysql query
    req.dbConnection.query('SELECT video_filepath AS filepath, video_filename AS filename FROM videomail WHERE id = ?', videoId, (err, result) => {
        if (err) {
            logger.error(`GET VIDEOMAIL ERROR: ${err.code}`);
        } else {
            console.log(`|${result[0].filepath}|`);
            if (result[0].filepath === 's3') {
                console.log(result[0].filename)
                const file = s3.getObject({ Bucket: utils.getConfigVal(config.s3.bucketname), Key: result[0].filename });

                res.writeHead(200, {
                    'Content-Type': 'video/webm',
                    'Accept-Ranges': 'bytes'
                });
                const filestream = file.createReadStream();
                filestream.pipe(res);
            } else {
                const videoFile = result[0].filepath + result[0].filename;
                try {
                    const stat = fs.statSync(videoFile);
                    // Added Accept-Ranges bytes to header so seek bar & setting
                    // video.currentTime works in Chrome without always going to time zero.
                    res.writeHead(200, {
                        'Content-Type': 'video/webm',
                        'Content-Length': stat.size,
                        'Accept-Ranges': 'bytes'
                    });
                    const readStream = fs.createReadStream(videoFile);
                    readStream.pipe(res);
                } catch (_err) {
                    res.status(500).send("Internal Error")
                }
            }
        }
    });
});

/**
   * Get the specific recording
   */
router.get('/getRecording', agentRestrict, (req, res) => {
    console.log(`USING ${req.query.fileName}`);
    const file = s3.getObject({ Bucket: utils.getConfigVal(config.s3.bucketname), Key: req.query.fileName });

    res.attachment(req.query.fileName);
    const filestream = file.createReadStream();
    filestream.pipe(res);
});



// For fileshare
// TODO Needs middleware for agent and consumer
// Use app,get for cooki to see if auth,  If not kicked
// Clam AV
const NodeClam = require('clamscan');
let ClamScan = null;
if (utils.getConfigVal(config.filesharing.virus_scan_enabled) === 'true' && fileSharingEnabled) {
  ClamScan = new NodeClam().init({
      remove_infected: true, // If true, removes infected files
      quarantine_infected: false, // False: Don't quarantine, Path: Moves files to this place.
      scan_log: null, // Path to a writeable log file to write scan results into
      debug_mode: true, // Whether or not to log info/debug/error msgs to the console
      file_list: null, // path to file containing list of files to scan (for scan_files method)
      scan_recursively: true, // If true, deep scan folders recursively
      clamscan: {
          path: '/usr/bin/clamscan', // Path to clamscan binary on your server
          db: null, // Path to a custom virus definition database
          scan_archives: true, // If true, scan archives (ex. zip, rar, tar, dmg, iso, etc...)
          active: true // If true, this module will consider using the clamscan binary
      },
      clamdscan: {
          socket: false, // Socket file for connecting via TCP
          host: false, // IP of host to connect to TCP interface
          port: false, // Port of host to use when connecting via TCP interface
          timeout: 60000, // Timeout for scanning files
          local_fallback: true, // Do no fail over to binary-method of scanning
          path: '/usr/bin/clamdscan', // Path to the clamdscan binary on your server
          config_file: null, // Specify config file if it's in an unusual place
          multiscan: true, // Scan using all available cores! Yay!
          reload_db: false, // If true, will re-load the DB on every call (slow)
          active: true, // If true, this module will consider using the clamdscan binary
          bypass_test: false // Check to see if socket is available when applicable
      },
      preference: 'clamdscan' // If clamdscan is found and active, it will be used by default
  });
}

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
router.post('/fileUpload', restrict, upload.single('uploadfile'), (req, res) => {
    let uploadedBy = req.session.user.vrs || ((req.session.user.role === 'AD Agent') ? req.body.vrs : false);

    if (!fileSharingEnabled) {
      // file sharing is disabled, do nothing
      res.status(200).send('Success');
      return;
    }

    // sometimes the consumer doesn't have it's vrs number in req.session
    // also sometimes the req.session doesn't update?? **** This is the issue
    // this is rare and hard to reproduce, but this will catch it when/if it does
    if (uploadedBy === undefined) {
        uploadedBy = req.session.data.valid;
    }

    console.log(`Uploaded by ${uploadedBy}`);
    console.log(`SESSION ${JSON.stringify(req.session)}`);

    if (uploadedBy) {
        console.log(`Valid agent ${uploadedBy}`);
        const uploadMetadata = {};

        if (uploadedBy === true) {
            // this means vrs isn't in the req.session
            // this is a weird workaround that finds the vrs
            // by looking at the agent extension and finding the vrs associated with it

            const uploadAgentExt = req.session.user.extension;

            for (let i = 0; i < sharingAgent.length; i += 1) {
                if (sharingAgent[i] === uploadAgentExt) {
                    uploadMetadata.vrs = sharingConsumer[i];
                    break;
                }
            }
        } else {
            uploadMetadata.vrs = uploadedBy;
        }
        uploadMetadata.filepath = path.join(__dirname, '..', req.file.path);
        uploadMetadata.originalFilename = req.file.originalname;
        uploadMetadata.filename = req.file.filename;
        // 'encoding' is deprecated — since July 2015
        uploadMetadata.encoding = req.file.encoding;
        uploadMetadata.mimetype = req.file.mimetype;
        uploadMetadata.size = req.file.size;

        if (utils.getConfigVal(config.filesharing.virus_scan_enabled) == 'true') {
            ClamScan.then(async (clamscan) => {
                try {
                    console.log('scanning', uploadMetadata.filepath, 'as', require('os').userInfo().username, fs.existsSync(uploadMetadata.filepath));

                    // You can re-use the `clamscan` object as many times as you want
                    // const version = await clamscan.get_version();
                    // console.log(`ClamAV Version: ${version}`);

                    const { isInfected, file, viruses } = await clamscan.is_infected(uploadMetadata.filepath);
                    if (isInfected) {
                        console.log(`${req.file.originalname} is infected with ${viruses}!`);
                        res.status(400).send('Error scanning file i');
                    } else {
                        console.log(`${req.file.originalname} passed inspection!`);
                        request({
                            method: 'POST',
                            url: `https://${utils.getConfigVal(config.servers.main_private_ip)}:${utils.getConfigVal(config.app_ports.mserver)}/storeFileInfo`,
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: uploadMetadata,
                            json: true
                        }, (error, _response, _data) => {
                            if (error) {
                                res.status(500).send('Error');
                            } else {
                                res.status(200).send('Success');
                            }
                        });
                    }
                } catch (err) {
                    // Handle any errors raised by the code in the try block
                    console.log('Error using Clam AV:', err);
                    res.status(400).send('Error scanning file');
                }
            }).catch((err) => {
                // Handle errors that may have occurred during initialization
                console.log('Error initializing Clam AV:', err);
                res.status(400).send('Error scanning file');
            });
        } else {
            console.log('WARNING: VIRUS SCAN IS DISABLED!');
            request({
                method: 'POST',
                url: `https://${utils.getConfigVal(config.servers.main_private_ip)}:${utils.getConfigVal(config.app_ports.mserver)}/storeFileInfo`,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: uploadMetadata,
                json: true
            }, (error, _response, _data) => {
                if (error) {
                    res.status(500).send('Error');
                } else {
                    res.status(200).send('Success');
                }
            });
        }
    } else {
        console.log('Not valid agent');
        res.status(403).send('Unauthorized');
    }
});

router.get('/getagentstatus/:token', (req, res) => {
    let resObj = {
        status: 'Unknown',
        r: 0,
        g: 0,
        b: 0,
        blink: false,
        stop: true
    };

    const { token } = req.params;
    if (token) {
        req.redisClient.hget(c.R_TOKEN_MAP, token, (err, status) => {
            if (err) {
                logger.error(`ERROR - /getagentstatus: ${err}`);
                res.status(501).send(resObj);
            } else if (status !== null) {
                switch (status) {
                    case 'AWAY':
                        resObj.status = status;
                        resObj.r = 255;
                        resObj.g = 165;
                        resObj.b = 0;
                        resObj.blink = false;
                        resObj.stop = false;
                        break;
                    case 'READY':
                        resObj.status = status;
                        resObj.r = 0;
                        resObj.g = 255;
                        resObj.b = 0;
                        resObj.blink = false;
                        resObj.stop = false;
                        break;
                    case 'INCOMINGCALL':
                        resObj.status = status;
                        resObj.r = 255;
                        resObj.g = 0;
                        resObj.b = 0;
                        resObj.blink = true;
                        resObj.stop = false;
                        break;
                    case 'TRANSFERRED_CALL':
                        resObj.status = status;
                        resObj.r = 255;
                        resObj.g = 255;
                        resObj.b = 255;
                        resObj.blink = true;
                        resObj.stop = false;
                        break;
                    case 'INCALL':
                        resObj.status = status;
                        resObj.r = 255;
                        resObj.g = 0;
                        resObj.b = 0;
                        resObj.blink = false;
                        resObj.stop = false;
                        break;
                    case 'WRAPUP':
                        resObj.status = status;
                        resObj.r = 0;
                        resObj.g = 0;
                        resObj.b = 255;
                        resObj.blink = false;
                        resObj.stop = false;
                        break;
                    default:
                        resObj.status = status;
                }
                res.send(resObj);
            } else {
                res.status(401).send('Invalid');
            }
        });
    } else {
        res.send(resObj);
    }
});

/**
 * Handles a GET request for /logout.
 * Destroys Cookies and Sessions for ACEDirect
 *
 * @param {string} '/logout'
 * @param {function} function(req, res)
 */

router.get('/logout', (req, res) => {
    req.session.user = null;
    req.session.save(function (err1) {
      req.session.regenerate(function (err2) {
        res.redirect(req.get('referer'));
      });
    });
});

router.get('/profilePic', (req, res) => {
    let key = '';

    let image;

      getAgent(req.session.user.username).then((data) => {
        if(data.data[0].profile_picture && data.data[0].profile_picture !== '') {
            key = data.data[0].profile_picture
        } else {
            throw new Error("No profile Pic!")
        }
        console.log("TYPEOF DATA:", typeof data)
        console.log("data.data[0].profile_picture:", data.data[0].profile_picture)
        console.log("typeof data.data[0].profile_picture", typeof data.data[0].profile_picture)
        let options = {
            Bucket : config.s3.bucketname,
            Key : key
        };            
        s3.getObject(options, (err, data) => {
            if(err) { 
                console.log("Error retrieving file from bucket!",err)
                try {
                    image = fs.readFileSync('./public/images/anon.png')
                    res.send(image)
                } catch(err) {
                    console.log("Could not read image!", err)
                }
            }
            else {
                console.log("success! Data retrieveed:", data.Body)
                image = data.Body
                res.send(image)
            }
        })
      }).catch(err => {
          console.log("Error finding agent!", err)
        try {
            image = fs.readFileSync('./public/images/anon.png')
            res.send(image)
        } catch(err) {
            console.log("Could not read image!", err)
        }
      })
})

router.get('/profilePicPoll', (req, res) => {
    var profilePicFlag = { profilePicExists : false };
    
    getAgent(req.session.user.username).then((data) => {
        if(data.data[0].profile_picture && data.data[0].profile_picture.length > 1) {
            console.log('User has a profile pic saved!')
            profilePicFlag.profilePicExists = true
        }
        res.send(profilePicFlag)
    });
})

router.get('/videomail', consumerRestrict, (req, res) => {  
    let introVideo = 'videomailGreeting.mp4';
    if (config.web_videomail && config.web_videomail.introVideo) {
      introVideo = utils.getConfigVal(config.web_videomail.introVideo);
      if (!introVideo || introVideo.length === 0) {
        introVideo = 'videomailGreeting.mp4';
      }
    }
    res.render('dro/pages/videomail', {redirectURL: utils.getConfigVal(config.complaint_redirect.url), redirectDesc: utils.getConfigVal(config.complaint_redirect.desc), maxRecordSeconds: utils.getConfigVal(config.videomail.max_record_secs), introVideo });
});

router.post('/videomailupload', consumerRestrict,  (req, res) => { //add restrict. this is for testing only
    const form = new formidable.IncomingForm();
    const dir = process.platform.match(/^win/) ? '\\..\\uploads\\videomails\\' : '/../uploads/videomails/';
    form.uploadDir = path.join(__dirname, dir);
    form.keepExtensions = true;
    form.maxFieldsSize = 10 * 1024 * 1024;
    form.maxFields = 1000;
    form.multiples = false;
  
    form.parse(req, (err, fields, files) => {
      if (err) {
        console.error(err);
        res.writeHead(200, {
          'content-type': 'text/plain',
        });
        res.write('an error occurred');
      } else {
          var filepath = files.file.filepath;
        fs.readFile(filepath, function (err, fileData) {
            if (files.file.mimetype === 'video/webm') {
            var uploadParams = { Bucket: utils.getConfigVal(config.s3.bucketname), Key: files.file.newFilename+'.webm', Body: "" };
            uploadParams.Body = fileData;
            s3.upload(uploadParams, function (err) {
              if (err) {
                console.log("Error!:", err);
                return
              }
              try {
                fs.unlinkSync(filepath)
              } catch (err) {
                console.error(err)
              }



        request({
            method: 'POST',
            url: 'https://'+utils.getConfigVal(config.servers.main_private_ip)+':'+utils.getConfigVal(config.app_ports.mserver)+'/UploadVideomail',
            rejectUnauthorized: false,
            form: {
              ext: '88888', //
              duration: Math.floor(fields.duration),
              phoneNumber: req.session.user.phone,
              filename: files.file.newFilename+'.webm'
            },
          }, function (error, response, data) {
            if (error) {
              console.log("Error", error);
              console.log("Could not upload:", new Date());
            } else {
              console.log("Successful video upload:", new Date());
            }
          });

});
            }
        })
    }

});
          


});

module.exports = router;
