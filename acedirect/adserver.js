const express = require('express');
const asteriskManager = require('asterisk-manager');
const nconf = require('nconf');
const util = require('util');
const log4js = require('log4js');
const fs = require('fs');
const request = require('request');
const bodyParser = require('body-parser');
const socketioJwt = require('socketio-jwt');
const zendeskApi = require('node-zendesk');
const https = require('https');
const redis = require('redis');
const cookieParser = require('cookie-parser'); // the session is stored in a cookie, so we use this to parse it
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const url = require('url');
const shortid = require('shortid');
const csrf = require('csurf');
const cors = require('cors');
const mysql = require('mysql');
const { MongoClient } = require('mongodb');
const c = require('./app/constants.js')
const utils = require('./app/utils.js')
const datConfig = require('./../dat/config.json')
const AWS = require('aws-sdk');
const proxy = require('proxy-agent');
const ping = require('ping');

const AMI_PING_ID = 'PING123';
const AMI_PING_MS = 5000;

AWS.config.update({
  region: datConfig.s3.region,
  httpOptions: {
    agent: proxy(datConfig.common.proxy)
  }
})

const s3 = new AWS.S3();

let dbConnection = null;
let dbconn = null;

// ping a server to see if it is reachable
const pingCfg = {
    timeout: 1
};
const checkAsterisk = (asteriskIp, amiId, amiPass, amiPort) => {
  let asteriskError = ''; // success - should be equal to '', set it to something else to test fail case.
  ping.sys.probe(asteriskIp, (isAlive) => {
    if (isAlive) {
      // server ping success
      sendEmit('asterisk-ping-check', '');
    } else {
      // server ping failed
      asteriskError = 'ERROR! Asterisk is unreachable.'; // ping failed
      sendEmit('asterisk-ping-check', asteriskError);
      console.log(`*** ${asteriskError} ; Asterisk server ping failed.***\n`);
    }
  }, pingCfg);
};

// For fileshare
// var upload = multer();

// CLEAN UP function; must be at the top!
// for exits, abnormal ends, signals, uncaught exceptions
//const cleanup = require('./cleanup').Cleanup(myCleanup);

function myCleanup() {
  // clean up code on exit, exception, SIGINT, etc.
  console.log('');
  console.log('***Exiting***');

  // MySQL DB cleanup
  if (dbConnection) {
    console.log('Cleaning up MySQL DB connection...');
    dbConnection.destroy();
  }

  // MongoDB cleanup
  if (dbconn) {
    console.log('Cleaning up MongoDB connection...');
    dbconn.close();
  }

  console.log('byeee.');
  console.log('');
}

// after hours vars
let isOpen = true;
let startTimeUTC = '14:00'; // hh:mm in UTC
let endTimeUTC = '21:30'; // hh:mm in UTC

// Declaration for Asterisk Manager Interface see init_ami()
let ami = null;

// file share
let sharingAgent = [];
let sharingConsumer = [];
let fileToken = [[]];
let incomingVRS;

// Initialize log4js
const logname = 'ad-server';
log4js.configure({
  appenders: {
    ad_server: {
      type: 'dateFile',
      filename: `logs/${logname}.log`,
      pattern: '-yyyy-MM-dd',
      alwaysIncludePattern: false,
      maxLogSize: 20971520,
      backups: 0
    }
  },
  categories: {
    default: {
      appenders: ['ad_server'],
      level: 'error'
    }
  }
});

// Get the name of the config file from the command line (optional)
nconf.argv().env();

const cfile = '../dat/config.json';

// Validate the incoming JSON config file
try {
  const content = fs.readFileSync(cfile, 'utf8');
  const myjson = JSON.parse(content);
} catch (ex) {
  console.log('');
  console.log('*******************************************************');
  console.log(`Error! Malformed configuration file: ${cfile}`);
  console.log('Exiting...');
  console.log('*******************************************************');
  console.log('');
  process.exit(1);
}

const logger = log4js.getLogger('ad_server');

nconf.file({
  file: cfile
});

/**
 * Function to verify the config parameter name and
 * decode it from Base64 (if necessary).
 * @param {type} param_name of the config parameter
 * @returns {unresolved} Decoded readable string.
 */
function getConfigVal(paramName) {
  const val = nconf.get(paramName);
  let decodedString = null;
  if (typeof val !== 'undefined' && val !== null) {
    // found value for paramName
    if (clearText) {
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
  return (decodedString.toString());
}

// the presence of a populated the 'cleartext' field in config.json
// means that the file is in clear text
// REMOVE the field or set it to "" if config.json is encoded
let clearText = false;
if (typeof (nconf.get('common:cleartext')) !== 'undefined' && nconf.get('common:cleartext') !== '') {
  // common:cleartext field is in config.json. assuming file is in clear text
  clearText = true;
}

let colorConfigs = utils.loadColorConfigs();

// Set log4js level from the config file
logger.level = getConfigVal('common:debug_level'); // log level hierarchy: ALL TRACE DEBUG INFO WARN ERROR FATAL OFF
logger.trace('TRACE messages enabled.');
logger.debug('DEBUG messages enabled.');
logger.info('INFO messages enabled.');
logger.warn('WARN messages enabled.');
logger.error('ERROR messages enabled.');
logger.fatal('FATAL messages enabled.');
logger.info(`Using config file: ${cfile}`);

const queuesComplaintNumber = getConfigVal('asterisk:queues:complaint:number');

// global vars that don't need to be read every time
const jwtKey = getConfigVal('web_security:json_web_token:secret_key');

// NGINX path parameter
let nginxPath = getConfigVal('nginx:ad_path');
if (nginxPath.length === 0) {
  // default for backwards compatibility
  nginxPath = '/ACEDirect';
}

// goodbye video parameter
let goodbyeVideo = getConfigVal('goodbye_video:enabled');
if (goodbyeVideo.length === 0) {
  goodbyeVideo = 'false'; // default
}

// outbound videomail timeout parameter
let outVidTimeout = getConfigVal('videomail:outbound_timeout_secs');
if (!outVidTimeout) {
  // default if not there
  outVidTimeout = 45 * 1000; // ms
} else {
  outVidTimeout *= 1000; // ms
}
logger.debug(`outVidTimeout: ${outVidTimeout}`);

// stun & turn params
const stunFQDN = getConfigVal('servers:stun_fqdn');
const stunPort = getConfigVal('app_ports:stun').toString();
const turnFQDN = getConfigVal('servers:turn_fqdn');
let turnPort = getConfigVal('app_ports:turn').toString();
const turnUser = getConfigVal('asterisk:sip:turn_user');
const turnCred = getConfigVal('asterisk:sip:turn_cred');
if (!stunFQDN) {
  console.log('ERROR: dat/config.json is missing servers:stun_fqdn');
  process.exit(0);
}
if (!stunPort) {
  console.log('ERROR: dat/config.json is missing app_ports:stun');
  process.exit(0);
}
if (!turnFQDN) {
  console.log('ERROR: dat/config.json is missing servers:turn_fqdn');
  process.exit(0);
}
if (!turnPort) {
  turnPort = ''; // blank is valid for this one
}
if (!turnUser) {
  console.log('ERROR: dat/config.json is missing asterisk:sip:turn_user');
  process.exit(0);
}
if (!turnCred) {
  console.log('ERROR: dat/config.json is missing turn_cred');
  process.exit(0);
}

// log WebWebRTC stats parameters
let logWebRTCStats = getConfigVal('webrtcstats:logWebRTCStats');
let logWebRTCStatsFreq = 60000;
if (!logWebRTCStats) {
  logWebRTCStats = false;
} else {
  logWebRTCStats = (logWebRTCStats === 'true');
}
logger.debug(`logWebRTCStats: ${logWebRTCStats}`);
if (logWebRTCStats) {
  const logWebRTCStatsFreqVal = getConfigVal('webrtcstats:logWebRTCStatsFreq');
  if (!logWebRTCStatsFreqVal) {
    logWebRTCStatsFreq = 0;
  } else {
    logWebRTCStatsFreq = parseInt(logWebRTCStatsFreqVal, 10);
  }
  logger.debug(`logWebRTCStatsFreq: ${logWebRTCStatsFreq}`);
}
let logWebRTCMongo = getConfigVal('webrtcstats:logWebRTCMongo');
logWebRTCMongo = logWebRTCMongo.trim();
logger.debug(`logWebRTCMongo: ${logWebRTCMongo}`);

// FPS meter values
let fpsHigh = getConfigVal('webrtcstats:fpsHigh');
if (!fpsHigh) fpsHigh = '25.0';
let fpsLow = getConfigVal('webrtcstats:fpsLow');
if (!fpsLow) fpsLow = '14.9';
let fpsMax = getConfigVal('webrtcstats:fpsMax');
if (!fpsMax) fpsMax = '30.0';
let fpsMin = getConfigVal('webrtcstats:fpsMin');
if (!fpsMin) fpsMin = '0.0';
let fpsOptimum = getConfigVal('webrtcstats:fpsOptimum');
if (!fpsOptimum) fpsOptimum = '40.0';

// busylight parameter
let busyLightEnabled = getConfigVal('busylight:enabled');
if (busyLightEnabled.length === 0) {
  // default for backwards compatibility
  busyLightEnabled = true;
} else {
  busyLightEnabled = (busyLightEnabled === 'true');
}
logger.debug(`busyLightEnabled: ${busyLightEnabled}`);

// busylight awayBlink parameter (blink while Away, if callers are in queue)
let awayBlink = getConfigVal('busylight:awayBlink');
if (awayBlink.length === 0) {
  // default to on
  awayBlink = true;
} else {
  awayBlink = (awayBlink === 'true');
}
logger.debug(`awayBlink: ${awayBlink}`);

let agentPath = getConfigVal('nginx:agent_route');
if (agentPath.length === 0) {
  agentPath = '/agent';
}

let consumerPath = getConfigVal('nginx:consumer_route');
if (consumerPath.length === 0) {
  consumerPath = '/complaint';
}

// signaling server
const signalingServerUrl = `${getConfigVal('signaling_server:protocol')}://${getConfigVal('servers:nginx_fqdn')}${getConfigVal('signaling_server:path')}`;

const queuesVideomailNumber = getConfigVal('asterisk:queues:videomail:number');

// get complaint redirect options
const complaintRedirectActive = (getConfigVal('complaint_redirect:active') === 'true');
const complaintRedirectDesc = getConfigVal('complaint_redirect:desc');
const complaintRedirectUrl = getConfigVal('complaint_redirect:url');

// translation server
const translationServerUrl = `${getConfigVal('translation_server:protocol')}://${getConfigVal('servers:asterisk_private_ip')}:${getConfigVal('app_ports:translation_server')}`;

// get the ACE Direct version and year
const version = getConfigVal('common:version');
const year = getConfigVal('common:year');
logger.info(`This is ACE Direct v${version}, Copyright ${year}.`);

// Create a connection to Redis
const redisClient = redis.createClient(getConfigVal('app_ports:redis').toString(), getConfigVal('servers:redis_fqdn'));

redisClient.on('error', (err) => {
  logger.error('');
  logger.error('**********************************************************');
  logger.error('REDIS CONNECTION ERROR: Please make sure Redis is running.');
  logger.error('**********************************************************');
  logger.error('');
  logger.error(err);
  console.error('');
  console.error('**********************************************************');
  console.error('REDIS CONNECTION ERROR: Please make sure Redis is running.');
  console.error('**********************************************************');
  console.error('');
  console.error(err);
  log4js.shutdown(() => { process.exit(-99); });
});

// catch Redis warnings
redisClient.on('warning', (wrn) => {
  logger.warn(`REDIS warning: ${wrn}`);
});

redisClient.auth(getConfigVal('database_servers:redis:auth'));

redisClient.on('connect', () => {
  logger.info('Connected to Redis');

  // Delete all values in REDIS maps at startup
  redisClient.del(c.R_TOKEN_MAP);
  redisClient.del(c.R_STATUS_MAP);
  redisClient.del(c.R_VRS_TO_ZEN_ID);
  redisClient.del(c.R_CONSUMER_EXTENSIONS);
  redisClient.del(c.R_EXTENSION_TO_VRS);
  redisClient.del(c.R_EXTENSION_TO_LANGUAGE);
  redisClient.del(c.R_LINPHONE_TO_AGENT_MAP);
  redisClient.del(c.R_CONSUMER_TO_CSR);
  redisClient.del(c.R_AGENT_INFO_MAP);
  redisClient.del(c.R_VRS_MAP);

  // Populate the consumerExtensions map
  prepareExtensions();
});

// Load the Zendesk login parameters
const zenUrl = `${getConfigVal('zendesk:protocol')}://${getConfigVal('servers:zendesk_fqdn')}:${getConfigVal('app_ports:zendesk')}/api/v2`;
const zenUserId = getConfigVal('zendesk:user_id');
const zenToken = getConfigVal('zendesk:token');

logger.info('Zendesk config:');
logger.info(`URL: ${zenUrl}`);
logger.info(`UserID: ${zenUserId}`);
logger.info(`Token: ${zenToken}`);

// Instantiate a connection to Zendesk
const zendeskClient = zendeskApi.createClient({
  username: zenUserId,
  token: zenToken,
  remoteUri: zenUrl
});

// filesharing enabled
const fileSharingEnabled = (getConfigVal('filesharing:enabled') === 'true') ? true : false;

// screensharing enabled
const screenSharingEnabled = (getConfigVal('screensharing:enabled') === 'true') ? true : false;

// autoplay enabled
const autoplayEnabled = (getConfigVal('autoplay_videos:enabled') === 'true') ? true : false;

const dbHost = getConfigVal('servers:mysql_fqdn');
const dbUser = getConfigVal('database_servers:mysql:user');
const dbPassword = getConfigVal('database_servers:mysql:password');
const dbName = getConfigVal('database_servers:mysql:ad_database_name');
const dbPort = getConfigVal('app_ports:mysql');
const vmTable = 'videomail';

// consumer portal customization defaults
const customizationDefaults = {
  sponsor: 'FCC',
  consumerPortalTitle: 'FCC ASL Consumer Support',
  consumerPortalLogo: 'dro/images/fcc-logo.jpg',
  consumerPortalDisclaimer: 'You are entering an Official United States Government System, which may be used only for authorized purposes. The Government may monitor and audit usage of this system, and all persons are hereby notified that use of this system constitutes consent to such monitoring and auditing. Unauthorized attempts to upload or change information on this web site is prohibited.',
  consumerPortalEndMessage: 'Your call with an FCC ASL Consumer Support agent has ended.'
};

function getCustomValue(customization) {
  // console.log(`found ${getConfigVal(`customizations:${customization}`)}`);
  return (getConfigVal(`customizations:${customization}`).length > 0) ? getConfigVal(`customizations:${customization}`) : customizationDefaults[customization];
}

const sponsor = getCustomValue('sponsor');
const consumerPortalTitle = getCustomValue('consumerPortalTitle');
const consumerPortalLogo = getCustomValue('consumerPortalLogo');
const consumerPortalDisclaimer = getCustomValue('consumerPortalDisclaimer');
const consumerPortalEndMessage = getCustomValue('consumerPortalEndMessage');

// Create MySQL connection and connect to the database
dbConnection = mysql.createConnection({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  port: dbPort
});

// better error checking for MySQL connection
dbConnection.connect((err) => {
  if (err !== null) {
    // MySQL connection ERROR
    console.error('');
    console.error('*************************************');
    console.error('ERROR connecting to MySQL. Exiting...');
    console.error('*************************************');
    console.error('');
    console.error(err);
    logger.error('');
    logger.error('*************************************');
    logger.error('ERROR connecting to MySQL. Exiting...');
    logger.error('*************************************');
    logger.error('');
    logger.error(err);
    log4js.shutdown(() => { process.exit(-1); });
  } else {
    // SUCCESSFUL connection
  }
});

// Pull MongoDB configuration from config.json file
let mongodbUri = null;
const mongodbFqdn = nconf.get('servers:mongodb_fqdn');
const mongodbTlsCaFile = nconf.get('database_servers:mongodb:tlsCAFile');

let mongodbTls = '';
if (mongodbTlsCaFile.length > 0) {
  mongodbTls = '?tls=true';
}

const mongodbCappedCollection = nconf.get('database_servers:mongodb:cappedCollection');
let cappedCollectionOptions = {};
if (mongodbCappedCollection) {
  cappedCollectionOptions = { capped: true, size: 1000000, max: 5000 };
}

if (typeof mongodbFqdn !== 'undefined' && mongodbFqdn) {
  mongodbUri = `mongodb://${getConfigVal('servers:mongodb_fqdn')}:${getConfigVal('app_ports:mongodb')}/${getConfigVal('database_servers:mongodb:database_name')}${mongodbTls}`;
}

const mongoOptions = {
  forceServerObjectId: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: false
};

if (mongodbTlsCaFile.length > 0) {
  mongoOptions.tlsCAFile = mongodbTlsCaFile;
}

const logCallData = nconf.get('database_servers:mongodb:logCallData');
let mongodb;
let colCallData = null;
// Connect to MongoDB
if (mongodbUri) {
  // Initialize connection once
  MongoClient.connect(mongodbUri, mongoOptions, (errConnect, database) => {
    if (errConnect) {
      logger.error('*** ERROR: Could not connect to MongoDB. Please make sure it is running.');
      console.error('*** ERROR: Could not connect to MongoDB. Please make sure it is running.');
      process.exit(-99);
    }

    mongodb = database.db();
    dbconn = database;

    // prepare an entry into MongoDB to log the acedirect restart
    const data = {
      Timestamp: new Date(),
      Role: 'acedirect',
      Purpose: 'Restarted'
    };

    if (logCallData) {
      // first check if collection "events" already exist, if not create one
      mongodb.listCollections({ name: 'calldata' }).toArray((_err, collections) => {
        console.log(`try to find calldata collection, colCallData length: ${collections.length}`);
        if (collections.length === 0) {
          // "stats" collection does not exist
          console.log('Creating new calldata colleciton in MongoDB');
          mongodb.createCollection('calldata', cappedCollectionOptions, (err, _result) => {
            if (err) throw err;
            console.log('Collection calldata is created capped size 100000, max 5000 entries');
            colCallData = mongodb.collection('calldata');
          });
        } else {
          // events collection exist already
          console.log('Collection calldata exists');
          colCallData = mongodb.collection('calldata');
          // insert an entry to record the start of ace direct
          colCallData.insertOne(data, (err, _result) => {
            if (err) {
              console.log(`Insert a record into calldata collection of MongoDB, error: ${err}`);
              logger.debug(`Insert a record into calldata collection of MongoDB, error: ${err}`);
              throw err;
            }
          });
        }
      });
    }
  });
} else {
  console.log('Missing MongoDB servers:mongodb_fqdn value in dat/config.json');
  logger.error('Missing MongoDB servers:mongodb_fqdn value in dat/config.json');
}

const credentials = {
  key: fs.readFileSync(getConfigVal('common:https:private_key')),
  cert: fs.readFileSync(getConfigVal('common:https:certificate'))
};

const sessionStore = new MongoDBStore({
  uri: mongodbUri,
  collection: 'mySessions'
});

const sessionMiddleware = session({
  secret: getConfigVal('fognito:session_secret'), 
  resave: true, 
  saveUninitialized: true, 
  store: sessionStore
});

const app = express();

app.use(cookieParser()); // must use cookieParser before expressSession
app.use(sessionMiddleware);

app.set('view engine', 'ejs');
app.use(express.static(`${__dirname}/public`));
app.use(bodyParser.urlencoded({
  extended: 'true'
})); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.use(bodyParser.json({
  type: 'application/vnd.api+json'
})); // parse application/vnd.api+json as json
app.use(csrf({
  cookie: true
}));

let fqdn = '';
if (nconf.get('servers:nginx_fqdn')) {
  fqdn = getConfigVal('servers:nginx_fqdn');
} else {
  logger.error('******************************************************');
  logger.error('ERROR servers:nginx_fqdn parameter required in dat/config.json');
  logger.error('******************************************************');
  logger.error('Exiting...');
  log4js.shutdown(() => { process.exit(-1); });
}
// Remove the newline
const fqdnTrimmed = fqdn.trim();
const fqdnUrl = `https://${fqdnTrimmed}:*`;

logger.info(`FQDN URL: ${fqdnUrl}`);

const httpsServer = https.createServer(credentials, app);

// constant to identify provider devices in AMI messages
const PROVIDER_STR = 'Provider';

const io = require('socket.io')(httpsServer, {
  cookie: false,
  origins: fqdnUrl
}); // path: '/TEST',
// io.set removed in socket.io 3.0. Origins now set in options during socket.io module inclusion.
// io.set('origins', fqdnUrl);

app.use(cors({
  origin: fqdnUrl
}));

httpsServer.listen(parseInt(getConfigVal('app_ports:acedirect'), 10));
console.log(`https webserver listening on ${parseInt(getConfigVal('app_ports:acedirect'), 10)}...`);
logger.info(`Config file: ${cfile}`);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Validates the token, if valid go to connection.
// If token is not valid, no connection will be established.
io.use(socketioJwt.authorize({
  secret: jwtKey,
  timeout: parseInt(getConfigVal('web_security:json_web_token:timeout'), 10), // seconds to send the authentication message
  handshake: getConfigVal('web_security:json_web_token:handshake')
}));

// Note - socket only valid in this block
io.sockets.on('connection', (socket) => {
  // We will see this on connect or browser refresh
  logger.info('NEW CONNECTION');
  logger.info(socket.request.connection._peername);

  /** 
     * Implementing callbacks for getting an agent using mserver getagentrec/:username
     * endpoint and mserver updateProfile endpoint. This is so the request code is contained
     * and isn't repeated multiple times in each S3 upload below. Also 
     * */ 
   const getAgent = (usnm) => {
    return new Promise((resolve, reject) => {
      console.log('Getting agent! Username: ', usnm)
      console.log('get agent link', `https://${datConfig.servers.main_private_ip}:${datConfig.app_ports.mserver}/getagentrec/${usnm}`)
      request({
        method: 'GET',
        headers : {'Accept': 'application/json'},
        url: `https://${datConfig.servers.main_private_ip}:${datConfig.app_ports.mserver}/getagentrec/${usnm}`,
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
  const updateAgent = (aId, first, last, role, phone, email, org, isApp, isAct, ext, q1_id, q2_id, profPic) => {
    return new Promise((resolve, reject) => {
      console.log("update agent data: ", aId, first, last, role, phone, email, org, isApp, isAct, ext, q1_id, q2_id, profPic)
      request({
        method: 'POST',
        url: `https://${datConfig.servers.main_private_ip}:${datConfig.app_ports.mserver}/updateProfile`,
        form : {
            agent_id : aId,
            first_name : first,
            last_name : last,
            role,
            phone,
            email,
            organization : org,
            isApproved : isApp,
            isActive : isAct,
            extension : ext,
            queue_id : q1_id,
            queue2_id : q2_id,
            profile_picture : profPic
        }
      }, function (error, response, data) {
        if (error) {
          console.log("Error", error);
          reject(error)
        } else {
          console.log("**Updating the agent was a success!**");
          console.log('response:', response)
          console.log('data:', data)
        }
      });
    });
  }

  socket.on('logWebRTCEvt', (data) => {
    // log to MongoDB
    data.username = token.username;
    const collName = 'webRTCStats';
    const agentWebRTCStats = mongodb.collection(collName);
    agentWebRTCStats.insertOne(data, (err, _result) => {
      if (err) {
        logger.error(`Insert into ${collName} collection of MongoDB FAILED. error: ${err}`);
        throw err;
      }
      logger.debug(`Logged a WebRTC stat to ${collName}...`);
    });
  });

  // emit
  if (getConfigVal('translation_server:enabled') === 'true') {
    socket.emit('enable-translation');
  }

  var token = socket.decoded_token;
  logger.info(`connected & authenticated: ${token.username} - ${token.first_name} ${token.last_name}`);
  logger.info(`ExpiresIn: ${token.exp - token.iat} seconds`);

  // Handle incoming Socket.IO registration requests from a client - add to the room
  socket.on('register-client', (_data) => {
    logger.info('Adding client socket to room:');
    logger.info(socket.id);
    logger.info(socket.request.connection._peername);

    // Add this socket to the room
    socket.join('my room');
  });

  socket.on('begin-file-share', (data) => {
    if (sharingAgent.includes(data.agentExt)) {
      // participants can already share files
      return;
    }

    if (sharingAgent.length === 0) {
      // first element
      sharingAgent[0] = token.extension;
      sharingConsumer[0] = incomingVRS;
      fileToken[0] = [];
      fileToken[0] = [];
    } else {
      for (let i = 0; i <= sharingAgent.length; i += 1) {
        if (i === sharingAgent.length) {
          // end of the list
          sharingAgent[i] = token.extension;
          sharingConsumer[i] = incomingVRS;
          fileToken[i] = [];
          fileToken[i] = [];
          break;
        } else if (sharingAgent[i] === '') {
          // fil any gaps
          sharingAgent[i] = token.extension;
          sharingConsumer[i] = incomingVRS;
          fileToken[i] = [];
          fileToken[i] = [];
          break;
        }
      }
    }

    // these should always be in sync
    // but is that guarunteed?
    console.log(sharingAgent);
    console.log(sharingConsumer);
    console.log(fileToken);

    for (let i = 0; i < sharingAgent.length; i += 1) {
      console.log(`${sharingAgent[i]} and ${sharingConsumer[i]} can share files`);
    }
  });

  socket.on('call-ended', (data) => {
    console.log('call ended');

    for (let i = 0; i < sharingAgent.length; i += 1) {
      if (data.agentExt === sharingAgent[i] || token.vrs === sharingConsumer[i]) {
        // empty
        sharingAgent[i] = '';
        sharingConsumer[i] = '';
        fileToken[i] = [];
        fileToken[i] = [];
      }
    }
    // check if the whole array is ''
    let isEmpty = true;
    for (let i = 0; i < sharingAgent.length; i += 1) {
      if (sharingAgent[i] !== '') {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) {
      sharingAgent = [];
      sharingConsumer = [];
      fileToken = [[]];
    }
    // console.log(sharingAgent);
    // console.log(sharingConsumer);
    // console.log(fileToken);
  });

  // Handle multiple files
  socket.on('get-file-list-agent', (data) => {
    console.log('AGENT HAS UPLOADED FILE');
    const vrsNum = (token.vrs) ? token.vrs : data.vrs;
    let url = `https://${getConfigVal('servers:main_private_ip')}:${getConfigVal('app_ports:mserver')}`;
    url += `/fileListByVRS?vrs=${vrsNum}`;
    request({
      url,
      json: true
    }, (error, response, results) => {
      if (error) {
        console.log('Error');
      } else if (results.message === 'Success') {
        const latestResult = results.result[results.result.length - 1];

        console.log('last 5 results: ');
        console.log(results.result.slice(Math.max(results.result.length - 5, 0)));

        redisClient.hget(c.R_CONSUMER_TO_CSR, Number(data.vrs), (_err, _agentExtension) => {
          let vrs = null;
          console.log(`Token is ${JSON.stringify(token)}\n and data is ${JSON.stringify(data)}`);

          // populate fileToken in the same spot as the uploader
          let uploader;
          if (token.vrs === undefined) {
            uploader = token.extension;
          } else {
            uploader = token.vrs;
          }

          for (let i = 0; i < sharingAgent.length; i += 1) {
            // console.log('comparing ' + sharingAgent[i] + ' to ' +uploader);
            // console.log('and ' +sharingConsumer[i]+ ' to ' +uploader);
            if (sharingAgent[i] === uploader) {
              fileToken[i].push(latestResult.id);
              console.log(`${sharingAgent[i]} shared file`);
              console.log('with id: ');
              console.log(fileToken[i]);
              break;
            }
          }
          console.log(`agents: ${sharingAgent}`);
          console.log(`consumers: ${sharingConsumer}`);
          console.log(`file ID: ${fileToken}`);

          // if (token.vrs) {
          // vrs = token.vrs;
          if (token.phone) {
            vrs = token.phone.replace(/-/g, '');
          } else {
            vrs = data.vrs;
          }
          console.log(`Sending file list message to ${vrsNum} with ${JSON.stringify(latestResult)}`);

          io.to(Number(vrsNum)).emit('fileListConsumer', (latestResult));
        });
      } else {
        console.log('Unkonwn error in get-file-list-agent');
        console.log(results);
      }
    });
  });

  socket.on('get-file-list-consumer', (data) => {
    console.log('CONSUMER HAS UPLOADED FILE');
    const vrsNum = (token.vrs) ? token.vrs : data.vrs;
    let url = `https://${getConfigVal('servers:main_private_ip')}:${getConfigVal('app_ports:mserver')}`;
    url += `/fileListByVRS?vrs=${vrsNum}`;
    request({
      url,
      json: true
    }, (error, response, results) => {
      if (error) {
        console.log('Error');
      } else if (results.message === 'Success') {
        const latestResult = results.result[results.result.length - 1];

        console.log('last 5 results: ');
        console.log(results.result.slice(Math.max(results.result.length - 5, 0)));

        redisClient.hget(c.R_CONSUMER_TO_CSR, Number(data.vrs), (_err, _agentExtension) => {
          let vrs = null;
          console.log(`Token is ${JSON.stringify(token)}\n and data is ${JSON.stringify(data)}`);

          // populate fileToken in the same spot as the uploader
          let uploader;
          if (token.vrs === undefined) {
            uploader = token.extension;
          } else {
            uploader = token.vrs;
          }

          for (let i = 0; i < sharingAgent.length; i += 1) {
            // console.log('comparing ' + sharingAgent[i] + ' to ' +uploader);
            // console.log('and ' +sharingConsumer[i]+ ' to ' +uploader);
            if (sharingConsumer[i] === uploader) {
              fileToken[i].push(latestResult.id);
              console.log(`${sharingConsumer[i]} shared file`);
              console.log('with id: ');
              console.log(fileToken[i]);
            }
          }
          console.log(`agents: ${sharingAgent}`);
          console.log(`consumers: ${sharingConsumer}`);
          console.log(`file ID: ${fileToken}`);

          // if (token.vrs) {
          // vrs = token.vrs;
          if (token.phone) {
            vrs = token.phone.replace(/-/g, '');
          } else {
            vrs = data.vrs;
          }
          console.log(`Sending file list message to ${vrsNum} with ${JSON.stringify(latestResult)}`);

          io.to(Number(vrsNum)).emit('fileListAgent', (latestResult));
        });
      } else {
        console.log('Unknown error in get-file-list-consumer');
        console.log(results);
      }
    });
  });

  /**
   * Upload Handler and event listener for setting profile pic.
   * TODO:
   * Implement upload handling function
   * Implement event listener
   */

  socket.on('profile-pic-set', (data, callback) => {
    console.log('Profile Picture Set!')
    callback("Emitter signal received!")

    var profilePic = data.picture
    var agentExt = data.agentExtension
    var agentUsnm = data.agentUsername
    var fileExt = data.fileExt

    console.log("Bucket: " + datConfig.s3.bucketname)

    var getParams = { Bucket : datConfig.s3.bucketname, Key : agentExt+'.'+fileExt }
    var uploadParams = { ...getParams, Body : profilePic, ContentType : 'image/*' }

    console.log("Upload parameters: " + JSON.stringify(uploadParams))

    s3.getObject(getParams, (err, data) => {
      if(err) {
        s3.upload(uploadParams, (err) => {
          if(err) {
            console.log("Error! Could not upload to S3 bucket: " + err)
          } else {
            getAgent(agentUsnm).then(agentInfoArray => {
              let agentInfo = agentInfoArray.data[0];
              
              console.log('agentInfo1', agentInfoArray.data[0])

              updateAgent(agentInfo.agent_id, agentInfo.first_name, agentInfo.last_name, agentInfo.role, agentInfo.phone, agentInfo.email,
                agentInfo.organization, agentInfo.is_approved, agentInfo.is_active, agentInfo.extension, agentInfo.queue_id, agentInfo.queue2_id,
                getParams.Key);
            }).catch(err => {
              console.log("Error getting agent!", err)
            })
          }
        })
      } else {
        s3.deleteObject(getParams, (err, data) => {
          if(err) console.log(err)
          else {
            console.log(data)
            s3.upload(uploadParams, (err) => {
              if(err) {
                console.log("Error! Could not upload to S3 bucket: " + err)
              } else {
                getAgent(agentUsnm).then(agentInfoArray => {
                  let agentInfo = agentInfoArray.data[0];

                  console.log('agentInfo2', agentInfoArray.data[0])

                  updateAgent(agentInfo.agent_id, agentInfo.first_name, agentInfo.last_name, agentInfo.role, agentInfo.phone, agentInfo.email,
                    agentInfo.organization, agentInfo.is_approved, agentInfo.is_active, agentInfo.extension, agentInfo.queue_id, agentInfo.queue2_id,
                    getParams.Key);
                })
              }
            })
          }
        })
      }
    })

  });

  socket.on('delete-profile-pic', (data, callback) => {
    fs.readFile('./public/images/anon.png', (err, data) => {
      if(err) {
        console.log("Could not read image!", err);
        callback('', err);
      } else {
        let image = data
        console.log("fs.readFileSync image:", image)
        callback(image);
      }
    })

    let username = data.username;
    let key = ''

    getAgent(username).then((data) => {
      if(data.data[0].profile_picture) {
        key = data.data[0].profile_picture
      } else {
        throw new Error("No profile Pic!")
      }

      let agentInfo = data.data[0];

      updateAgent(agentInfo.agent_id, agentInfo.first_name, agentInfo.last_name, agentInfo.role, agentInfo.phone, agentInfo.email,
        agentInfo.organization, agentInfo.is_approved, agentInfo.is_active, agentInfo.extension, agentInfo.queue_id, agentInfo.queue2_id,
        '');

      let deleteParams = { Bucket : datConfig.s3.bucketname, Key : key }

      s3.deleteObject(deleteParams, (err, data) => {
        if(err) {
          console.log("There was an error deleting the user profile picture in S3 bucket!", err);
        } else {
          console.log("Deleting image successful!", data)
        }
      })
    }).catch(e => {
      console.log("Error deleting profile pic!", e)
    });
  });

  // language translation
  socket.on('send-agent-language', (data) => {
    const vrs = data.vrs;
    const agentLanguage = data.agentLanguage;
    const agentExt = data.agentExt;
    io.to(Number(vrs)).emit('receive-agent-language', { agentLanguage, agentExt });
  });

  socket.on('consumer-closed-translation-modal', (data) => {
    const ext = data.agentExt;
    io.to(Number(ext)).emit('consumer-translation-setup-finished');
  });

  socket.on('transferCallInvite', (data) => {
    // send the original ext through so we know who should terminate the call
    io.to(Number(data.transferExt)).emit('receiveTransferInvite', { originalExt: data.originalExt, vrs: data.vrs, transferExt: data.transferExt });
  });

  socket.on('denyingTransfer', (data) => {
    io.to(Number(data.originalExt)).emit('transferDenied');
  });

  socket.on('transferInviteAccepted', (data) => {
    io.to(Number(data.originalExt)).emit('beginTransfer');
  });

  socket.on('joiningTransfer', (data) => {
    redisClient.hset(c.R_STATUS_MAP, token.username, 'INCALL', (_err, _res) => {
      sendAgentStatusList(token.username, 'INCALL');
      redisClient.hset(c.R_TOKEN_MAP, token.lightcode, 'INCALL');
    });
    io.to(Number(data.originalExt)).emit('transferJoined');
  });

  socket.on('multiparty-hangup', (data) => {
    io.to(Number(data.newHost)).emit('multiparty-transfer', { transitionAgent: data.transitionAgent, vrs: data.vrs });

    // reinvite the transitionAgent if it exists
    if (data.transitionAgent) {
      io.to(Number(data.transitionAgent)).emit('multiparty-reinvite');
    }
    if (data.vrs) {
      io.to(Number(data.vrs)).emit('consumer-multiparty-hangup');
    }
  });

  // Handle new multi party invite since we need to manually tell the agent a call is coming.
  socket.on('multiparty-invite', (data) => {
    io.to(Number(data.extensions)).emit('new-caller-ringing', {
      callerNumber: data.extensions,
      phoneNumber: data.callerNumber,
      vrs: data.vrs
    });
  });

  socket.on('consumer-captions-enabled', (data) => {
    io.to(Number(data.agentExt)).emit('begin-captioning');
  });

  socket.on('multiparty-caption-agent', (data) => {
    if (data.final) {
      // only send finals during a multiparty call, browser caption engine fragments sentences
      const d = new Date();
      data.timestamp = d.getTime();
      data.msgid = d.getTime();
      if (data.hasMonitor) {
        // send multiparty captions to the monitor
        io.to(Number(data.monitorExt)).emit('multiparty-caption', data);
      } else if (data.participants && data.participants.length > 0) {
        data.participants.forEach((p) => {
          redisClient.hget(c.R_EXTENSION_TO_VRS, Number(p), (err, vrsNum) => {
            if (!err) {
              // p = (vrsNum) ? vrsNum : p;
              p = (vrsNum) || p;
              io.to(Number(p)).emit('multiparty-caption', data);
            }
          });
        });
      }
    } else {
      const d = new Date();
      data.timestamp = d.getTime();
      data.msgid = d.getTime();
      data.participants.forEach((p) => {
        redisClient.hget(c.R_EXTENSION_TO_VRS, Number(p), (err, vrsNum) => {
          if (!err) {
            // p = (vrsNum) ? vrsNum : p;
            p = (vrsNum) || p;
            io.to(Number(p)).emit('multiparty-caption', data);
          }
        });
      });
    }
  });

  //data = ["caption-consumer",{"transcript":" 1 2 3 4 5","final":true,"language":"en-US"}]
  socket.on('caption-consumer', (data) => {
    if (token.vrs) {
      // only send finals from browser based captions. Browser captions fragment phrases
      const d = new Date();
      data.timestamp = d.getTime();
      data.msgid = d.getTime();
      data.displayname = (token.first_name && token.last_name) ? token.first_name+" "+token.last_name:"Consumer";
      io.to(Number(token.vrs)).emit('consumer-caption', data);
    }
  });

  socket.on('requestScreenshare', (data) => {
    console.log(`Receiving screenshare request to ${data.agentNumber}`);
    io.to(Number(data.agentNumber)).emit('screenshareRequest', {
      agentNumber: data.agentNumber
    });
  });

  socket.on('screenshareResponse', (data) => {
    console.log('Received agent screenshare reply');
    io.to(Number(data.number)).emit('screenshareResponse', {
      permission: data.permission
    });
  });

  socket.on('agent-screensharing', (data) => {
    io.to(Number(data.consumerExt)).emit('agentScreenshare')
  });

  socket.on('askMonitor', (data) => {
    io.to(Number(data.originalExt)).emit('initiateMonitor', { monitorExt: data.monitorExt });
  });

  // invite the monitoring agent to the call
  socket.on('monitor-invite', (data) => {
    console.log('at monitor invite');
    io.to(Number(data.monitorExt)).emit('monitor-join-session', { vrs: data.vrs });
  });

  socket.on('stopMonitoringCall', (data) => {
    io.to(Number(data.originalExt)).emit('monitor-left');
    if (data.vrs) {
      io.to(Number(data.vrs)).emit('consumer-stop-monitor');
      socket.leave(Number(data.vrs));
    }
  });

  socket.on('start-monitoring-consumer', (data) => {
    io.to(Number(data.vrs)).emit('consumer-being-monitored');
  });

  socket.on('force-monitor-leave', (data) => {
    io.to(Number(data.monitorExt)).emit('monitor-leave-session', { reinvite: data.reinvite, multipartyHangup: data.multipartyHangup, multipartyTransition: data.multipartyTransition });
  });

  socket.on('reinvite-monitor', (data) => {
    io.to(Number(data.monitorExt)).emit('monitor-rejoin-session');
  });

  // Fired at end of call when new call history is added
  socket.on('callHistory', (data) => {
    console.log(`callhistory for ${token.username}`);
    mongodb.listCollections({ name: `${token.username}callHistory` }).toArray((_err, collections) => {
      let colCallHistory;
      if (collections.length === 0) {
        // "stats" collection does not exist
        console.log(`Creating new ${token.username}callHistory colleciton in MongoDB`);
        mongodb.createCollection(`${token.username}callHistory`, cappedCollectionOptions, (err, _result) => {
          if (err) throw err;
          console.log(`Collection ${token.username}callHistory is created capped size 100000, max 5000 entries`);
          colCallHistory = mongodb.collection(`${token.username}callHistory`);
        });
      } else {
        // events collection exist already
        colCallHistory = mongodb.collection(`${token.username}callHistory`);
        // colCallHistory.remove({});
        // insert an entry to record the start of ace direct
        colCallHistory.insertOne(data, (err, _result) => {
          if (err) {
            console.log(`Insert a record into ${token.username}callHistory collection of MongoDB, error: ${err}`);
            logger.debug(`Insert a record into ${token.username}callHistory collection of MongoDB, error: ${err}`);
            throw err;
          }
        });
      }
    });
  });

  socket.on('getCallHistory', () => {
    console.log(`callhistory for ${token.username}`);
    mongodb.listCollections({ name: `${token.username}callHistory` }).toArray((_err, collections) => {
      let colCallHistory;
      if (collections.length === 0) {
        console.log(`Creating new ${token.username}callHistory colleciton in MongoDB`);
        mongodb.createCollection(`${token.username}callHistory`, cappedCollectionOptions, (err, _result) => {
          if (err) throw err;
          console.log('Collection callHistory is created capped size 100000, max 5000 entries');
          colCallHistory = mongodb.collection(`${token.username}callHistory`);
        });
      } else {
        // events collection exist already
        console.log(`Collection ${token.username}callHistory exists`);
        colCallHistory = mongodb.collection(`${token.username}callHistory`);
        // insert an entry to record the start of ace direct
        colCallHistory.find({}).toArray((err, result) => {
          if (err) {
            console.log(`Insert a record into ${token.username}callHistory collection of MongoDB, error: ${err}`);
            logger.debug(`Insert a record into ${token.username}callHistory collection of MongoDB, error: ${err}`);
            throw err;
          } else {
            socket.emit('returnCallHistory', result);
          }
        });
      }
    });
  });

  socket.on('set-shortcuts', (data) => {
    // first check if collection already exist, if not create one
    mongodb.listCollections({ name: `${token.username}shortcuts` }).toArray((_err, collections) => {
      let colShortcuts;
      if (collections.length === 0) {
        // "stats" collection does not exist
        console.log('Creating new shortcuts colleciton in MongoDB');
        mongodb.createCollection(`${token.username}shortcuts`, (err, _result) => {
          if (err) {
            console.log(`error creating collection: ${err}`);
            throw err;
          }
          console.log(`Collection ${token.username}shortcuts is created`);
          colShortcuts = mongodb.collection(`${token.username}shortcuts`);
        });
      } else {
        // collection exist already
        // console.log("Collection shortcuts exists");
        colShortcuts = mongodb.collection(`${token.username}shortcuts`);

        // updates the shortcut if it exists. create a new document if not
        colShortcuts.updateOne(
          { _id: data._id },
          { $set: { task: data.task, shortcut: data.shortcut } },
          { upsert: true }
        );
      }
    });
  });

  socket.on('get-shortcuts', () => {
    mongodb.listCollections({ name: `${token.username}shortcuts` }).toArray((_err, collections) => {
      let colShortcuts;
      if (collections.length === 0) {
        // collection does not exist
        console.log('Creating new shortcuts colleciton in MongoDB');
        mongodb.createCollection(`${token.username}shortcuts`, (err, _result) => {
          if (err) {
            console.log(`error creating collection: ${err}`);
            throw err;
          }
          console.log('Collection shortcuts is created');
          colShortcuts = mongodb.collection(`${token.username}shortcuts`);
        });
      } else {
        // console.log("Collection shortcuts exists");
        colShortcuts = mongodb.collection(`${token.username}shortcuts`);

        colShortcuts.find({}).toArray((err, result) => {
          if (err) {
            console.log(`error getting shortcuts: ${err}`);
            throw err;
          } else {
            socket.emit('receive-shortcuts', result);
          }
        });
      }
    });
  });

  socket.on('reset-shortcuts', () => {
    console.log('resetting shortcuts');
    const colShortcuts = mongodb.collection(`${token.username}shortcuts`);
    colShortcuts.deleteMany({});
  });

  // Get all agents statuses and extensions.  Used for multi party option dropdown.
  /* socket.on('ami-req', function(message){
    if(message === 'agent'){
      socket.emit('agent-resp', {
        'agents' : Agents
      });
    }
  }); */

  // Handle incoming Socket.IO registration requests from an agent - add to the room
  socket.on('register-agent', (_data) => {
    logger.info(`Adding agent socket to room named: ${token.extension}`);
    logger.info(socket.id);
    logger.info(socket.request.connection._peername);

    // Add this socket to the room
    socket.join(token.extension);

    // register agent to asterisk.
    setInitialLoginAsteriskConfigs(token);

    io.to(token.extension).emit('lightcode-configs', colorConfigs);
    const skinny = getConfigVal('skinny_mode:agent');
    io.to(token.extension).emit('skinny-config', skinny);

    const captionAgent = getConfigVal('caption_mode:agent');
    io.to(token.extension).emit('caption-config', captionAgent);

    let url = `https://${getConfigVal('servers:main_private_ip')}:${getConfigVal('app_ports:mserver')}`;
    if (url) {
      url += '/getallscripts/';

      request({
        url,
        json: true
      }, (error, response, data) => {
        if (error) {
          logger.error('ERROR: /getallscripts/');
          data = {
            message: 'failed'
          };
          io.to(token.extension).emit('script-data', data);
        } else {
          io.to(token.extension).emit('script-data', data);
        }
      });
    }
  });

  /* pause/unpause a queue
     For example...
     b: "true" , "false"
     ext: "33001"
     qname: "ComplaintsQueue"
  */
  function pauseQueue(b, ext, qname) {
    logger.info(`pauseQueue() , ${b.toString()} , ${ext}, ${qname}`);
    ami.action({
      Action: 'QueuePause',
      ActionId: '1000',
      Interface: `PJSIP/${ext}`,
      Paused: b.toString(),
      Queue: qname,
      Reason: 'QueuePause in pause-queue event handler'
    }, (_err, _res) => { });
  }

  /*
   * Handler catches a Socket.IO message to pause both queues. Note, we are
   * pausing both queues, but, the extension is the same for both.
   */
  socket.on('pause-queues', () => {
    // Pause the first queue
    if (token.queue_name) {
      logger.info(`PAUSING QUEUE: PJSIP/${token.extension}, queue name ${token.queue_name}`);
      pauseQueue(true, token.extension, token.queue_name);
    }

    // Pause the second queue (if not null)
    if (token.queue2_name) {
      logger.info(`PAUSING QUEUE: PJSIP/${token.extension}, queue name ${token.queue2_name}`);
      pauseQueue(true, token.extension, token.queue2_name);
    }
  });

  // Sets the agent state to READY
  socket.on('ready', () => {
    logger.info(`State: READY - ${token.username}`);
    redisClient.hset(c.R_STATUS_MAP, token.username, 'READY', (_err, _res) => {
      sendAgentStatusList(token.username, 'READY');
      redisClient.hset(c.R_TOKEN_MAP, token.lightcode, 'READY');
    });
  });

  // Sets the agent state to AWAY
  socket.on('away', () => {
    logger.info(`State: AWAY - ${token.username}`);
    redisClient.hset(c.R_STATUS_MAP, token.username, 'AWAY', (_err, _res) => {
      sendAgentStatusList(token.username, 'AWAY');
      redisClient.hset(c.R_TOKEN_MAP, token.lightcode, 'AWAY');
    });
  });

  // Sets the agent state to WRAPUP
  socket.on('wrapup', () => {
    pauseQueue(true, token.extension, token.queue_name); // pause agent during wrapup mode
    pauseQueue(true, token.extension, token.queue2_name); // pause agent during wrapup mode

    logger.info(`State: WRAPUP - ${token.username}`);
    redisClient.hset(c.R_STATUS_MAP, token.username, 'WRAPUP', (_err, _res) => {
      sendAgentStatusList(token.username, 'WRAPUP');
      redisClient.hset(c.R_TOKEN_MAP, token.lightcode, 'WRAPUP');
    });
  });

  // Sets the agent state to INCALL
  socket.on('incall', (data) => {
    logger.info(`State: INCALL - ${token.username}`);
    if (data.vrs) {
      // Dealing with a WebRTC consumer, otherwise, it is a Linphone
      socket.join(Number(data.vrs));
    }
    redisClient.hset(c.R_STATUS_MAP, token.username, 'INCALL', (_err, _res) => {
      sendAgentStatusList(token.username, 'INCALL');
      redisClient.hset(c.R_TOKEN_MAP, token.lightcode, 'INCALL');
    });
  });

  // Sets the agent state to INCOMINGCALL
  socket.on('incomingcall', () => {
    logger.info(`State: INCOMINGCALL - ${token.username}`);
    redisClient.hset(c.R_STATUS_MAP, token.username, 'INCOMINGCALL', (_err, _res) => {
      sendAgentStatusList(token.username, 'INCOMINGCALL');
      redisClient.hset(c.R_TOKEN_MAP, token.lightcode, 'INCOMINGCALL');
    });
  });

  // Sets the agent state to TRANSFERRED_CALL
  socket.on('incomingtransferredcall', () => {
    logger.info(`State: TRANSFERRED_CALL - ${token.username}`);
    redisClient.hset(c.R_STATUS_MAP, token.username, 'TRANSFERRED_CALL', (_err, _res) => {
      sendAgentStatusList(token.username, 'TRANSFERRED_CALL');
      redisClient.hset(c.R_TOKEN_MAP, token.lightcode, 'TRANSFERRED_CALL');
    });
  });

  // Sets the agent state to MISSEDCALL
  socket.on('missedcall', () => {
    logger.info(`State: MISSEDCALL - ${token.username}`);
    redisClient.hset(c.R_STATUS_MAP, token.username, 'MISSEDCALL', (_err, _res) => {
      sendAgentStatusList(token.username, 'MISSEDCALL');
      redisClient.hset(c.R_TOKEN_MAP, token.lightcode, 'MISSEDCALL');
    });
  });

  // Sends request for agent assistance to the Management Portal
  socket.on('request-assistance', () => {
    logger.info(`Request Assistance - ${token.username}:${token.extension}`);
    const url = `https://${getConfigVal('servers:main_private_ip')}:${getConfigVal('app_ports:managementportal')}/agentassist`; // assumes managementportal is co-located with adserver
    request({
      url,
      qs: {
        extension: token.extension
      },
      json: true
    }, (err, res, data) => {
      if (err) {
        logger.error(`Error - Request Assistance: ${err}`);
        io.to(token.extension).emit('request-assistance-response', {
          message: 'An Error Occured'
        });
      } else {
        io.to(token.extension).emit('request-assistance-response', data);
      }
    });
  });

  /*
   * Handler catches a Socket.IO message to unpause both queues. Note, we are
   * unpausing both queues, but, the extension is the same for both.
   */
  socket.on('unpause-queues', () => {
    if (token.queue_name) {
      logger.info(`UNPAUSING QUEUE: PJSIP/${token.extension}, queue name ${token.queue_name}`);
      pauseQueue(false, token.extension, token.queue_name);
    }

    if (token.queue2_name) {
      logger.info(`UNPAUSING QUEUE: PJSIP/${token.extension}, queue name ${token.queue2_name}`);
      pauseQueue(false, token.extension, token.queue2_name);
    }
  });

  socket.on('get_color_config', () => {
    sendEmit('lightcode-configs',utils.loadColorConfigs())
  });
  socket.on('send-name', (data) => {
    io.to(Number(data.vrs)).emit('agent-name', data);
  });
  socket.on('save-grid-layout', (data) => {
    const requestJson = {};
    requestJson.agent_id = token.agent_id;
    requestJson.layout = data.gridLayout;
    request({
      method: 'POST',
      url: `https://${getConfigVal('servers:main_private_ip')}:${getConfigVal('app_ports:mserver')}/updateLayoutConfig`,
      headers: {
        'Content-Type': 'application/json'
      },
      body: requestJson,
      json: true
    }, (error, _response, _data) => {
      if (error) {
        logger.error(`save-grid-layout ERROR: ${error}`);
        io.to(token.extension).emit('save-grid-layout-error', 'Error');
      } else {
        io.to(token.extension).emit('save-grid-layout-success', 'Success');
      }
    });
  });

  socket.on('get-dial-in-number', (data) => {
    let dialInNumber;
    const obj = {
      Action: 'Command',
      command: 'database show global/dialin'
    };

    ami.action(obj, (err, res) => {
      if (err) {
        console.log('error getting dial-in number');
        console.log(JSON.stringify(err));
      } else {
        console.log('success getting dial-in number');
        const outputValues = Object.values(res.output[0]);
        let num = '';

        for (let i = 0; i < outputValues.length; i += 1) {
          if (!isNaN(outputValues[i]) && outputValues[i] !== ' ') {
            num += outputValues[i];
          }
        }

        if (num.length === 10) {
          dialInNumber = `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6)}`;
        } else {
          dialInNumber = 'UNKNOWN';
        }

        io.to(data.extension).emit('dialin-number', { number: dialInNumber });
      }
    });
  });

  // Handler catches a Socket.IO disconnect
  socket.on('disconnect', () => {
    logger.info('DISCONNECTED');
    logger.info(socket.id);
    logger.info(socket.request.connection._peername);

    // Removes user from statusMap
    if ('agent_id' in token) {
      logout(token);
    }

    // Remove the consumer from the extension map.
    if (token.vrs) {
      redisClient.hget(c.R_EXTENSION_TO_VRS, Number(token.vrs), (_err, ext) => {
        const regexStr = `/^PJSIP/${ext}-.*$/`;
        ami.action({
          Action: 'Hangup',
          ActionID: '4',
          Channel: regexStr
        }, (err, _res) => {
          if (err) {
            logger.info('ERROR in hangup');
          } else {
            logger.info('SUCCESS hangup');
          }
        });

        redisClient.hget(c.R_CONSUMER_EXTENSIONS, Number(ext), (err, reply) => {
          if (err) {
            logger.error(`Redis Error${err}`);
          } else if (reply) {
            const val = JSON.parse(reply);
            val.inuse = false;
            redisClient.hset(c.R_CONSUMER_EXTENSIONS, Number(ext), JSON.stringify(val));
            redisClient.hdel(c.R_EXTENSION_TO_VRS, Number(ext));
            redisClient.hdel(c.R_EXTENSION_TO_VRS, Number(token.vrs));
            redisClient.hdel(c.R_EXTENSION_TO_LANGUAGE, Number(ext));
          }
        });
      });
    }
  });

  // ######################################################
  // All Socket.IO events below are ACD-specific

  /*
   * Flow from consumer portal
   * 1. Consumer provides VRS #, email, complaint, sends to node server.
   * 2. Node server does a VRS lookup, creates a Zendesk ticket, then
   * returns VRS data and Zendesk ticket number.
   */

  // Handler catches a Socket.IO event (ad-ticket) to create
  // a Zendesk ticket based on incoming info.
  socket.on('ad-ticket', (data) => {
    logger.info(`Received a Zendesk ticket request: ${JSON.stringify(data)}`);
    logger.info(`Session Token: ${JSON.stringify(token)}`);

    processConsumerRequest(data);
  });

  // Handler catches a Socket.IO event (modify-ticket)
  // to modify an existing Zendesk ticket based on incoming info.
  socket.on('modify-ticket', (data) => {
    logger.info(`Received a Zendesk UPDATE ticket request: ${JSON.stringify(data)}`);
    logger.info(`Session Token: ${JSON.stringify(token)}`);

    updateZendeskTicket(data);
  });

  // defaults to false
  const isMuted = getConfigVal('agent_incall_audio:mute_all_audio');
  socket.emit('mute-options', { isMuted });

  const saveChatHistory = getConfigVal('agent_chat:save_agent_chats');
  socket.emit('save-chat-value', { isSaved: saveChatHistory });

  const languageTranslationEnabled = (getConfigVal('language_translation:translation_enabled') === 'true') ? true : false;
  socket.emit('language-translation-enabled', { languageTranslationEnabled });

  // direct messaging between agents
  socket.on('check-agent-chat-status', (data) => {
    if (saveChatHistory === 'true') {
      // if collection with data participants exists, send collection
      // if not, create collection
      let chatMembers = [data.destext, data.senderext];

      if (chatMembers.length < 2) {
        console.log('ERROR');
      } else {
        chatMembers = chatMembers.sort();
        const extensionsChat = chatMembers.toString();

        mongodb.listCollections({ name: `${extensionsChat}chatHistory` }).toArray((err, collections) => {
          let colChatHistory;
          if (collections.length === 0) {
            // collection does not exist
            console.log('Creating new chatHistory colleciton in MongoDB');

            if (err) throw err;

            colChatHistory = mongodb.collection(`${extensionsChat}chatHistory`);
            console.log(`Collection ${extensionsChat}chatHistory is created `);

            socket.emit('begin-agent-chat');
          } else {
            // collection exist already
            colChatHistory = mongodb.collection(`${extensionsChat}chatHistory`);

            socket.emit('continue-agent-chat', { destExt: data.destext });
          }
        });
      }
    }
  });

  socket.on('get-agent-chat', (data) => {
    if (saveChatHistory === 'true') {
      let chatMembers = [data.destext, data.senderext];
      chatMembers = chatMembers.sort();
      const extensionsChat = chatMembers.toString();

      const colChatHistory = mongodb.collection(`${extensionsChat}chatHistory`);

      colChatHistory.find({}).sort({ $natural: -1 }).limit(100).toArray((err, result) => {
        // only load the last 100 chats to prevent lagging
        if (err) {
          console.log(`Get agent chat error: ${err}`);
          logger.debug(`Get agent chat error: ${err}`);
          throw err;
        } else {
          socket.emit('load-agent-chat-messages', result);
        }
      });
    }
  });

  socket.on('upload-agent-message', (data) => {
    io.to(Number(data.destext)).emit('new-agent-chat', data);

    if (saveChatHistory === 'true') {
      let chatMembers = [data.destext, data.senderext];
      chatMembers = chatMembers.sort();
      const extensionsChat = chatMembers.toString();

      const colChatHistory = mongodb.collection(`${extensionsChat}chatHistory`);
      colChatHistory.insertOne(data, (err, _result) => {
        if (err) {
          console.log(`Insert a record into chatHistory collection of MongoDB, error: ${err}`);
          logger.debug(`Insert a record into chatHistory collection of MongoDB, error: ${err}`);
          throw err;
        }
      });
    }
  });

  // for testing only-- drop all chatHistory collections
  socket.on('clear-chat-messages', () => {
    mongodb.listCollections().toArray((errListCollections, results) => {
      if (errListCollections) throw errListCollections;

      for (let i = 0; i < results.length; i += 1) {
        if (results[i].name.includes('chatHistory')) {
          const colChatHistory = mongodb.collection(results[i].name);
          colChatHistory.drop((err, success) => {
            if (err) throw err;
            if (success) console.log('collection dropped');
          });
        }
      }
    });
  });

  socket.on('get-my-chats', (data) => {
    if (saveChatHistory === 'true') {
      const chats = [];

      mongodb.listCollections().toArray((errListCollections, results) => {
        if (errListCollections) throw errListCollections;

        for (let i = 0; i < results.length; i += 1) {
          if (results[i].name.includes(data.ext) && results[i].name.includes('chatHistory')) {
            chats.push(results[i].name);
          }
        }

        // get the last document from those chats
        const totalChats = chats.length;
        for (let i = 0; i < chats.length; i += 1) {
          const colChatHistory = mongodb.collection(chats[i]);

          colChatHistory.find().sort({ $natural: -1 }).limit(1).next()
            .then(
              (doc) => {
                socket.emit('my-chats', { doc, total: totalChats });
              },
              (err) => {
                console.log('Error:', err);
              }
            );
        }
      });
    }
  });

  // RTT for agent to agent chat
  socket.on('agent-chat-typing', (data) => {
    const { ext } = data;
    let msg = data.rttmsg;
    // Replace html tags with character entity code
    msg = msg.replace(/</g, '&lt;');
    msg = msg.replace(/>/g, '&gt;');
    io.to(Number(ext)).emit('agent-typing', {
      typingmessage: `${data.displayname} is typing...`,
      displayname: data.displayname,
      rttmsg: msg
    });
  });

  // RTT for agent to agent chat
  socket.on('agent-chat-typing-clear', (data) => {
    const { ext } = data;

    io.to(Number(ext)).emit('agent-typing-clear', {
      displayname: data.displayname
    });
  });

  socket.on('chat-read', (data) => {
    if (saveChatHistory === 'true') {
      let chatMembers = [data.ext, data.destext];
      chatMembers = chatMembers.sort();
      const extensionsChat = chatMembers.toString();

      mongodb.listCollections({ name: `${extensionsChat}chatHistory` }).toArray((_err, _collections) => {
        const colChatHistory = mongodb.collection(`${extensionsChat}chatHistory`);
        // console.log('recipient opened message');
        colChatHistory.updateMany(
          {},
          { $set: { hasBeenOpened: true } },
          {}
        );
      });
    }
  });

  socket.on('broadcast-agent-chat', (data) => {
    const broadcastExtensions = [];
    io.to('my room').emit('broadcast', data);
    const clients = io.sockets.adapter.rooms.get('my room');

    for (const clientId of clients ) {
      const clientSocket = io.sockets.sockets.get(clientId);
      broadcastExtensions.push(clientSocket.decoded_token.extension);
    }

    if (saveChatHistory === 'true') {
      // insert the broadcast into each conversation's db
      for (let i = 0; i < broadcastExtensions.length; i += 1) {
        data.destname = '';
        const currentExt = broadcastExtensions[i];

        data.destext = broadcastExtensions[i];

        let chatMembers = [currentExt, data.senderext];
        chatMembers = chatMembers.sort();
        const extensionsChat = chatMembers.toString();

        const colChatHistory = mongodb.collection(`${extensionsChat}chatHistory`);
        colChatHistory.insertOne(data, (err, _result) => {
          if (err) {
            console.log(`Insert a record into chatHistory collection of MongoDB, error: ${err}`);
            logger.debug(`Insert a record into chatHistory collection of MongoDB, error: ${err}`);
            throw err;
          } else {
            console.log('Successfully inserted broadcast message');
          }
        });
      }
    }
  });

  socket.on('update-broadcast-name', (data) => {
    if (saveChatHistory === 'true') {
      console.log('updating destname of broadcast');

      let chatMembers = [data.destext, data.senderext];
      chatMembers = chatMembers.sort();
      const extensionsChat = chatMembers.toString();

      mongodb.listCollections({ name: `${extensionsChat}chatHistory` }).toArray((_err, _collections) => {
        const colChatHistory = mongodb.collection(`${extensionsChat}chatHistory`);

        colChatHistory.updateOne(
          { displayname: data.sendername, timeSent: data.time },
          { $set: { destname: data.name } },
          { upsert: false }
        );
      });
    }
  });

  // Handler catches a Socket.IO event (register-vrs) to create a new socket to the consumer portal.
  socket.on('register-vrs', (data) => {
    if (token.vrs) {
      logger.info(`chat: register-vrs - if() case ${token.vrs}`);
      socket.join(Number(token.vrs));
      const skinny = getConfigVal('skinny_mode:consumer');
      io.to(token.vrs).emit('skinny-config', skinny);
      const captionCons = getConfigVal('caption_mode:consumer');
      io.to(token.vrs).emit('caption-config', captionCons);
    } else {
      logger.info(`chat: register-vrs - else() case ${data.vrs}`);
      socket.join(Number(data.vrs));
    }
  });

  // Handler catches a Socket.IO event (call-initiated)
  // to register the consumer with a JsSIP extension
  socket.on('call-initiated', (data, callback) => {
    logger.info(`Received a JsSIP consumer extension creation request: ${JSON.stringify(data)}`);
    request({
      method: 'GET',
      headers: { Accept: 'application/json' },
      url: `https://${datConfig.servers.main_private_ip}:${datConfig.app_ports.mserver}/operatinghours`
    }, (error, res, responseData) => {
      if (error) {
        console.log('Error polling operating hours:', error);
        processExtension(data);
      }
      const jsonData = JSON.parse(responseData);
      console.log(jsonData);
      console.log('typeof data', typeof jsonData);
      callback(jsonData.isOpen);

      if (jsonData.isOpen) {
        console.log('Call Center is open!');
        processExtension(data);
      } else {
        console.log('Call Center is closed!');
      }
    });
  });

  // Handler catches a Socket.IO event (chat-message)
  // to create a Zendesk ticket based on incoming info.
  socket.on('chat-message', (data) => {
    let vrs = null;
    let msg = data.message;

    // prevent vrs consumer from spoofing a vrs
    if (token.vrs) {
      vrs = token.vrs;
    } else {
      vrs = data.vrs;
    }

    // Replace html tags with character entity code
    msg = msg.replace(/</g, '&lt;');
    msg = msg.replace(/>/g, '&gt;');
    data.message = msg;

    io.to(Number(vrs)).emit('chat-message-new', data);
  });

  socket.on('translate', (data) => {
    //Remove comment for Debugging only, privacy violation to write transcripts to log file
    //console.log(`Received data is ${JSON.stringify(data)}`);
    request({
      method: 'GET',
      url: `${translationServerUrl}/translate?languageFrom=${data.fromLanguage}&text=${encodeURI(data.message)}&languageTo=${data.toLanguage}`,
      headers: {
        'Content-Type': 'application/json'
      }
    }, (error, response, newData) => {
      if (error) {
        logger.error(`translate ERROR: ${error}`);
        console.error(`translate ERROR: ${error}`);
        socket.emit('chat-message-new-translated', data);
        socket.emit('translate-language-error', error);
      } else {
        const dataObj = JSON.parse(newData);
        //Remove comment for Debugging only, privacy violation to write transcripts to log file
        //console.log(`Translation is ${dataObj.translation}`);
        data.message = dataObj.translation;
        socket.emit('chat-message-new-translated', data);
      }
    });
  });

  // Handler catches a Socket.IO event (chat-typing)
  // to send the user an 'is typing...' message in the chat window.
  socket.on('chat-typing', (data) => {
    let vrs = null;
    let msg = data.rttmsg;
    if (token.vrs) {
      vrs = token.vrs;
    } else {
      vrs = data.vrs;
    }
    // Replace html tags with character entity code
    msg = msg.replace(/</g, '&lt;');
    msg = msg.replace(/>/g, '&gt;');
    io.to(Number(vrs)).emit('typing', {
      typingmessage: `${data.displayname} is typing...`,
      displayname: data.displayname,
      rttmsg: msg
    });
  });

  // Handler catches a Socket.IO event (chat-typing-clear)
  // to clear the 'is typing...' message in the chat window.
  socket.on('chat-typing-clear', (data) => {
    let vrs = null;
    if (token.vrs) {
      vrs = token.vrs;
    } else {
      vrs = data.vrs;
    }
    io.to(Number(vrs)).emit('typing-clear', {
      displayname: data.displayname
    });
  });

  // Handler catches a Socket.IO event (chat-leave-ack) to leave the ongoing chat.
  socket.on('chat-leave-ack', (data) => {
    logger.info(`Received chat-leave-ack${JSON.stringify(data)}`);

    if (data.vrs) {
      // Dealing with a WebRTC consumer, otherwise, it is a Linphone
      socket.leave(Number(data.vrs));
    }
  });

  /*
   * Handler catches a Socket.IO event (input-vrs) so we can create the extension to VRS
   * mapping, and, look up the Zendesk ticket ID number.
   */
  socket.on('input-vrs', (data) => {
    logger.info(`Received input-vrs ${JSON.stringify(data)}, calling vrsAndZenLookup() `);

    // Redis c.R_EXTENSION_TO_VRS must reverse map
    redisClient.hset(c.R_EXTENSION_TO_VRS, Number(data.extension), Number(data.vrs));
    redisClient.hset(c.R_EXTENSION_TO_VRS, Number(data.vrs), Number(data.extension));

    vrsAndZenLookup(Number(data.vrs), Number(data.extension));
  });

  // resends agent status list to update colors when the config file changes
  socket.on('update-agent-list', (_data) => {
    sendAgentStatusList();
  });

  // ######################################
  // Videomail-specific socket.io events

  // Retrieval of videomail records from the database
  socket.on('get-videomail', (data) => {
    const filterFlag = !((data.filter === 'ALL' || typeof data.filter === 'undefined'));
    const sort = (typeof data.sortBy === 'undefined') ? [] : data.sortBy.split(' ');

    const vmSqlSelect = `SELECT id, extension, callbacknumber, recording_agent, processing_agent,
      received, processed, video_duration, status, deleted, src_channel, dest_channel, unique_id,
      video_filename, video_filepath FROM ${vmTable}`;
    let vmSqlWhere = 'WHERE deleted = 0';
    let vmSqlOrder = '';
    const vmSqlParams = [];

    if (filterFlag) {
      vmSqlWhere += ' and status = ?';
      vmSqlParams.push(data.filter);
    }
    if (sort.length === 2) {
      vmSqlOrder = ' ORDER BY ??';
      vmSqlParams.push(sort[0]);
      if (sort[1] === 'desc') {
        vmSqlOrder += ' DESC';
      }
    }

    const vmSqlQuery = `${vmSqlSelect} ${vmSqlWhere} ${vmSqlOrder};`;
    dbConnection.query(vmSqlQuery, vmSqlParams, (err, result) => {
      if (err) {
        logger.error(`GET-VIDEOMAIL ERROR: ${err.code}`);
      } else {
        io.to(token.extension).emit('got-videomail-recs', result);
      }
    });

    const vmSqlCountQuery = `SELECT COUNT(*) AS unreadMail FROM ${vmTable} WHERE UPPER(status)='UNREAD';`;
    dbConnection.query(vmSqlCountQuery, (err, result) => {
      if (err) {
        logger.error(`COUNT-UNREAD-MAIL ERROR: ${err.code}`);
      } else {
        io.to(token.extension).emit('got-unread-count', result[0].unreadMail);
      }
    });

    const vmSqlDeleteOld = `UPDATE ${vmTable} SET deleted = 1, deleted_time = CURRENT_TIMESTAMP,
      deleted_by = 'auto_delete' WHERE (UPPER(status)='READ' OR UPPER(status)='CLOSED') AND
      TIMESTAMPDIFF(DAY, processed, CURRENT_TIMESTAMP) >= 14;`;
    dbConnection.query(vmSqlDeleteOld, (err, _result) => {
      if (err) {
        logger.error(`DELETE-OLD-VIDEOMAIL ERROR: ${err.code}`);
      }
    });
  });

  // updates videomail records when the agent changes the status
  socket.on('videomail-status-change', (data) => {
    logger.debug('updating MySQL entry');
    const vmSqlQuery = `UPDATE ${vmTable} SET status = ?, processed = CURRENT_TIMESTAMP,
      processing_agent = ? WHERE id = ?;`;
    const vmSqlParams = [data.status, token.extension, data.id];

    logger.debug(`${vmSqlQuery} ${vmSqlParams}`);

    dbConnection.query(vmSqlQuery, vmSqlParams, (err, result) => {
      if (err) {
        logger.error(`VIDEOMAIL-STATUS-CHANGE ERROR: ${err.code}`);
      } else {
        logger.debug(result);
        io.to(token.extension).emit('changed-status', result);
      }
    });
  });
  // updates videomail records when the agent deletes the videomail.
  // Keeps it in db but with a deleted flag
  socket.on('videomail-deleted', (data) => {
    logger.debug('updating MySQL entry');

    const vmSqlQuery = `UPDATE ${vmTable} SET deleted_time = CURRENT_TIMESTAMP, deleted_by = ?, deleted = 1  WHERE id = ?;`;
    const vmSqlParams = [token.extension, data.id];

    logger.debug(`${vmSqlQuery} ${vmSqlParams}`);

    dbConnection.query(vmSqlQuery, vmSqlParams, (err, result) => {
      if (err) {
        logger.error(`VIDEOMAIL-DELETE ERROR: ${err.code}`);
      } else {
        logger.debug(result);
        io.to(token.extension).emit('changed-status', result);
      }
    });
  });

  // Retrieval of videomail records from the database
  socket.on('get-recordings', (data) => {
    const filterFlag = !((data.filter === 'ALL' || typeof data.filter === 'undefined'));
    const sort = (typeof data.sortBy === 'undefined') ? [] : data.sortBy.split(' ');

    const recordingSqlSelect = 'SELECT fileName, agentNumber, timeStamp, participants, status, duration FROM call_recordings';
    let recordingSqlWhere = `WHERE deleted = 0 AND agentNumber = "${token.extension}"`;
    let recordingSqlOrder = '';
    const recordingSqlParams = [];

    if (filterFlag) {
      console.log(`GETTING ${data.filter}`);
      // Checking for custom phone number filtering
      if (data.filter.split(' ')[0] === 'participants') {
        recordingSqlWhere += ` AND ${data.filter}`;
        // recording_sql_params.push(data.filter);
      } else {
        recordingSqlWhere += ' and status = ?';
        recordingSqlParams.push(data.filter);
      }
    }
    if (sort.length === 2) {
      if (data.filter.split(' ')[0] === 'participants') {
        recordingSqlOrder = '';
      } else {
        recordingSqlOrder = ' ORDER BY ??';
        recordingSqlParams.push(sort[0]);
        if (sort[1] === 'desc') {
          recordingSqlOrder += ' DESC';
        }
      }
    }

    const recordingSqlQuery = `${recordingSqlSelect} ${recordingSqlWhere} ${recordingSqlOrder};`;
    logger.debug(`QUERY IS ${recordingSqlQuery}`);
    dbConnection.query(recordingSqlQuery, recordingSqlParams, (err, result) => {
      if (err) {
        logger.error(`RECORDING-ERROR: ${err.code}`);
        console.log(`Got recording error: ${err}`);
      } else {
        logger.debug(`GOT RESULTS ${JSON.stringify(result)}`);
        io.to(token.extension).emit('got-call-recordings', result);
      }
    });
  });

  // updates recording records when the agent changes the status
  socket.on('recording-status-change', (data) => {
    logger.debug('updating MySQL entry');
    const recordingSqlQuery = 'UPDATE call_recordings SET status = ? WHERE fileName = ?;';
    const recordingSqlParams = [data.status, data.fileName];
    dbConnection.query(recordingSqlQuery, recordingSqlParams, (err, result) => {
      if (err) {
        console.log(`Recording status error ${err}`);
        logger.error(`RECORDING-STATUS-CHANGE ERROR: ${err.code}`);
      } else {
        logger.debug(result);
        console.log(`Status change results ${JSON.stringify(result)}`);
        io.to(token.extension).emit('record-changed-status', result);
      }
    });
  });

  socket.on('recording-deleted', (data) => {
    const recordingSqlQuery = 'UPDATE call_recordings SET deleted_time = CURRENT_TIMESTAMP, deleted_by = ?, deleted = 1  WHERE fileName = ?;';
    const recordingSqlParams = [data.extension, data.fileName];

    logger.debug(`${recordingSqlQuery} ${recordingSqlParams}`);

    dbConnection.query(recordingSqlQuery, recordingSqlParams, (err, result) => {
      if (err) {
        logger.error(`RECORDING-DELETE ERROR: ${err.code}`);
      } else {
        logger.debug(result);
        io.to(token.extension).emit('record-changed-status', result);
      }
    });
  });

  /**
   * Socket call for request to obtain file from fileShare
   */
  socket.on('uploadFile', (data) => {
    console.log(`RECEIVED EVENT FILE ${data}`);
    logger.info(`Adding agent socket to room named: ${token.extension}`);
    logger.info(socket.id);
    logger.info(socket.request.connection._peername);

    // Add this socket to the room
    socket.join(token.extension);

    let url = `https://${getConfigVal('servers:main_private_ip')}:9905`;
    if (url) {
      url += '/storeFileName';

      request({
        url,
        method: 'POST'
        // TODO Add the file body
      }, (error, response, data) => {
        if (error) {
          logger.error('ERROR: /storeFileName/');
          data = {
            message: 'failed'
          };
          console.log('Error on file share');
          // io.to(token.extension).emit('script-data', data);
        } else {
          // io.to(token.extension).emit('script-data', data);
          console.log('File share connection successful.');
          console.log(`RESPONSE ${JSON.stringify(response)}`);
          socket.emit('postFile', response);
        }
      });
    }
  });

  socket.on('set-agent-language', (data) => {
    console.log('setting language', Number(data.extension), data.language);
    redisClient.hset(c.R_EXTENSION_TO_LANGUAGE, Number(data.extension), data.language);
  });

  socket.on('translate-caption', (data) => {
    // fixme do we have to test this to avoid hacks or bugs?
    const callerNumber = data.callerNumber.toString();
    const { msgid } = data.transcripts;
    const { final } = data.transcripts;
    let displayname = data.displayname || 'Consumer';
    if (displayname === ' ') {
      displayname = 'Consumer';
    }
    //Remove comment for Debugging only, privacy violation to write transcripts to log file
    //console.log('translating', data);

    let fromNumber;
    let toNumber;
    let languageFrom;
    let languageTo;

    redisClient.hgetall(c.R_CONSUMER_TO_CSR, (errHgeTail, tuples) => {
      if (errHgeTail) {
        logger.error(`Redis Error${errHgeTail}`);
        console.log(`Redis Error${errHgeTail}`);
      } else {
        for (const clientNumber in tuples) {
          const agentNumber = tuples[clientNumber];
          if (callerNumber === agentNumber) {
            fromNumber = clientNumber;
            toNumber = agentNumber;
          } else if (callerNumber === clientNumber) {
            fromNumber = agentNumber;
            toNumber = clientNumber;
          }
        }
        const promises = [
          new Promise((resolve, reject) => {
            redisClient.hget(c.R_EXTENSION_TO_LANGUAGE, Number(fromNumber), (err, language) => {
              if (err) {
                logger.error(`Redis Error${err}`);
                reject(err);
              } else {
                languageFrom = language;
                if (!languageFrom) {
                  languageFrom = 'en-US'; // default English
                }

                resolve();
              }
            });
          }),
          new Promise((resolve, reject) => {
            redisClient.hget(c.R_EXTENSION_TO_LANGUAGE, Number(toNumber), (err, language) => {
              if (err) {
                logger.error(`Redis Error${err}`);
                reject(err);
              } else {
                languageTo = language;
                if (!languageTo) {
                  languageTo = 'en-US'; // default English
                }
                resolve();
              }
            });
          })
        ];

        Promise.all(promises).then((_values) => {
          //Remove comment for Debugging only, privacy violation to write transcripts to log file
          //console.log('language', fromNumber, toNumber, languageFrom, languageTo);
          //console.log('translating', data.transcripts.transcript, 'from', languageFrom, 'to', languageTo);
          const encodedText = encodeURI(data.transcripts.transcript.trim());
          const translationUrl = `${translationServerUrl}/translate?languageFrom=${languageFrom}&text=${encodedText}&languageTo=${languageTo}`;
          
          if (languageTo === languageFrom) {
            socket.emit('caption-translated', {
              transcript: data.transcripts.transcript.trim(),
              displayname,
              agent: data.transcripts.agent,
              msgid,
              final,
              speakerExt: data.speakerExt
            });
          } else {
            request({
              method: 'GET',
              url: translationUrl,
              headers: {
                'Content-Type': 'application/json'
              },
              json: true
            }, (error, response, translationData) => {
              if (error) {
                logger.error(`GET translation: ${error}`);
                console.error(`GET translation error: ${error}`);
              } else if (!translationData.translation) {
                console.error('No translation was received from translation server');
              } else {
                //Remove comment for Debugging only, privacy violation to write transcripts to log file
                //console.log('received translation', translationData);
                //console.log(languageFrom, languageTo, translationUrl);

                // fixme will this be wrong if multiple clients/agents?
                socket.emit('caption-translated', {
                  transcript: translationData.translation,
                  displayname,
                  agent: data.transcripts.agent,
                  msgid,
                  final
                });
              }
            });
          }
        }).catch((err) => {
          console.log('Error in translate-caption', err.message); // some coding error in handling happened
        });
      }
    });
  });
});

/**
 * updates and emits All Agents status to 'my room'
 * data is used to update the agent status table
 * of the index page.
 *
 * @param {undefined} Not used.
 * @returns {undefined} Not used
 */
function sendAgentStatusList(agent, value) {
  if (agent) {
    redisClient.hget(c.R_AGENT_INFO_MAP, agent, (_err, agentInfo) => {
      if (agentInfo) {
        const agentInfoJSON = JSON.parse(agentInfo);
        agentInfoJSON.status = value;
        redisClient.hset(c.R_AGENT_INFO_MAP, agent, JSON.stringify(agentInfoJSON), () => {
          redisClient.hvals(c.R_AGENT_INFO_MAP, (err, values) => {
            const aList = [];
            for (const id in values) {
              aList.push(JSON.parse(values[id]));
            }
            io.to('my room').emit('agent-status-list', {
              message: 'success',
              agents: aList
            });
          });
        });
      }
    });
  } else { // forces socket emit without an update to user agent status map.
    redisClient.hvals(c.R_AGENT_INFO_MAP, (err, values) => {
      const aList = [];
      for (const id in values) {
        aList.push(JSON.parse(values[id]));
      }
      io.to('my room').emit('agent-status-list', {
        message: 'success',
        agents: aList
      });
    });
  }
}

/**
 * Event handler to catch the incoming AMI action response. Note, this is
 * a response to an AMI action (request from this node server) and is NOT
 * an Asterisk auto-generated event.
 *
 * @param {type} evt Incoming Asterisk AMI event.
 * @returns {undefined} Not used
 */
function handleActionResponse(data) {
  // only checking ping responses right now
  if (data.actionid.startsWith(AMI_PING_ID) && data.response === 'Success') {
    sendEmit('asterisk-ami-check', ''); // healthy AMI
  }
}

// this method requires "popticket": {"url": "https://someurl.com/...."}, in the config file
function popZendesk(callId, ani, agentid, agentphonenum, skillgrpnum,
  skillgrpnam, callernam, dnis) {
  let popurl = '';
  if (typeof (nconf.get('popticket:url')) === 'undefined') {
    logger.info('popZendesk: popticket:url is not in the config file. Skipping popZendesk...');
    return;
  }
  popurl = getConfigVal('popticket:url');
  logger.info(`popZendesk: popticket:url is ${popurl}`);

  const formData = {};
  const properties = {};
  // REQUIRED. The CallID that identifies call in originating system (Asterisk)
  properties.CallId = callId;
  // REQUIRED. Phone number of the caller.  Used to locate the caller in Zendesk
  properties.ANI = ani;
  // REQUIRED. The agentid or extension that identifies
  // the answering agent to the phone system (Asterisk).
  properties.AgentID = agentid;
  // The phone number / extension of the agent that answered call.  Might be same as AgentID.
  properties.AgentPhoneNumber = agentphonenum;
  properties.SkillGroupNumber = skillgrpnum; // The number of queue or huntgroup of the call
  properties.DTKSkillGroupName = skillgrpnam; // The name of the queue or huntgroup of the call.
  properties.CallerName = callernam; // The name of caller or caller id info if available.
  properties.DNIS = dnis; // The dialed number or destination that caller called/dialed.
  properties.Language = 'asl_call_center'; // required by FCC
  formData.m_eventName = 'DTK_EXT_TELEPHONY_CALL_ANSWERED';
  formData.m_properties = {};
  formData.m_properties.Properties = properties;
  logger.info(`popZendesk form body: ${JSON.stringify(formData)}`);

  request({
    method: 'POST',
    url: popurl,
    headers: {
      'Content-Type': 'application/json'
    },
    body: formData,
    json: true
  }, (error, _response, _data) => {
    if (error) {
      logger.error('');
      logger.error('*****************************');
      logger.error('ERROR - could not pop Zendesk');
      logger.error('*****************************');
      logger.error('');
      logger.error(`popZendesk ERROR: ${error}`);
    } else {
      logger.info('popZendesk Success ');
    }
  });
}

/**
 * Insert a call data record into calldata collection of MongoDB
 *
 * @param {string} eventType One of these event types: "Handled", "Web", "Videomail", "Abandoned"
 */
function insertCallDataRecord(eventType, vrs, uniqueId, origin) {
  if (logCallData) {
    colCallData = mongodb.collection('calldata');

    const data = {
      Timestamp: new Date(), Event: eventType, UniqueId: uniqueId, Origin: origin
    };
    if (vrs != null) {
      data.vrs = vrs;

      console.log(`INSERTING CALL DATA ${JSON.stringify(data, null, 2)}`); // here
      colCallData.insertOne(data, (err, _result) => {
        if (err) {
          console.log(`Insert a call data record into calldata collection of MongoDB, error: ${err}`);
          logger.debug(`Insert a call data record into calldata collection of MongoDB, error: ${err}`);
        }
      });
    }
  }
}

/**
 * Event handler to catch the incoming AMI events. Note, these are the
 * events that are auto-generated by Asterisk (don't require any AMI actions
 * sent by this node server). Only concerned with the DialEnd and Hangup events.
 *
 * PLEASE NOTE! Only the AMI events we care about will be passed to this method. To see the events
 * or add more events, modify init_ami().
 *
 * @param {type} evt Incoming Asterisk event.
 * @returns {undefined} Not used
 */
function handleManagerEvent(evt) {
  logger.info('\n\n######################################');
  logger.info(`Received an AMI event: ${evt.event}`);
  logger.info(util.inspect(evt, false, null));
  // console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>The event is " + evt.event);
  switch (evt.event) {
    case ('VarSet'):
      const channel = evt.channel.split(/[\/,-]/);
      if (channel[1] && (channel[1].startsWith('ProviderPurple') || channel[1].startsWith('ProviderZVRS')) && evt.variable && evt.variable.bridgepeer === '') {
        const agentExt = evt.value.split(/[\/,-]/);
        console.log('sending new-peer to', agentExt[1]);
        if (agentExt[1]) {
          io.to(agentExt[1]).emit('new-peer', {});
        }
      }
      break;

    // Sent by Asterisk when the call is answered
    case ('DialEnd'):
      // Make sure this is an ANSWER event only
      if (evt.dialstatus === 'ANSWER') {
        logger.info(`DialEnd / ANSWER: evt.context is: >${evt.context}< , evt.channel is: >${evt.channel}<`);
        logger.info(`Event is ${JSON.stringify(evt, null, 2)}`);

        if (evt.context === 'from-internal' && evt.destchannel.includes(PROVIDER_STR)) {
          const { channel } = evt;
          const channelExt = channel.split(/[\/,-]/);
          io.to(Number(channelExt[1])).emit('outbound-answered', {});
        }
        /*
         * For the complaints queue, we do the following:
         * - Get the extension number (channel field?)
         * - Look up the corresponding VRS (extensionToVrs map)
         * - Do a VRS lookup
         * - Use the extension and VRS to find the corresponding
         *   Zendesk ticket (zenIdToExtensionData map)
         *
         * Note, calls from WebRTC go to the complaints queue, while calls from the Zphone go to the
         * 'Provider_Complaints' queue (corresponds to option #5 on the Zphone).
         */
        if (evt.context === 'from-internal' || evt.context === 'Complaints' || evt.context === 'Provider_Complaints') {
          // Case #5

          logger.info(`DialEnd processing from a Complaints queue call. evt.context is: ${evt.context} , evt.channel is: ${evt.channel}`);

          // Format is PJSIP/nnnnn-xxxxxx, we want to strip out the nnnnn only
          var extString = evt.channel;
          var extension = extString.split(/[\/,-]/);
          let isOurPhone = false;

          // is this one of our phones? one that we expect?
          if (extension[1].startsWith(PROVIDER_STR)) {
            isOurPhone = true;
            logger.info(`Matched on ${extension[1]}, setting extension[1] to ${evt.calleridnum}`);
            extension[1] = evt.calleridnum;
          } else {
            logger.info(`No phone match, but this could be a WebRTC extension: ${extension[1]}. leaving extension[1] alone to continue processing...`);
          }

          const destExtString = evt.destchannel;
          const destExtension = destExtString.split(/[\/,-]/);
          redisClient.hset(c.R_CONSUMER_TO_CSR, Number(extension[1]), Number(destExtension[1]));
          logger.info(`Populating consumerToCsr: ${extension[1]} => ${destExtension[1]}`);
          logger.info(`Extension number: ${extension[1]}`);
          logger.info(`Dest extension number: ${destExtension[1]}`);

          if (extension[1].length >= 10) {
            // pop here, because we already have the consumer phone number
            popZendesk(evt.destuniqueid, extension[1], destExtension[1], destExtension[1], '', '', '', '');

            console.log(`CONSUMER VRS NUMBER ${extension[1]}`);
          }

          redisClient.hget(c.R_EXTENSION_TO_VRS, Number(extension[1]), (err, vrsNum) => {
            if (!err && vrsNum) {
              // Call new function
              logger.info(`Calling vrsAndZenLookup with ${vrsNum} and ${destExtension[1]}`);
              // console.log("HAVE VRS NUMBER " + vrsNum);
              // console.log("INSERTING WEB CALL HANDLED");
              insertCallDataRecord('Handled', vrsNum, evt.uniqueid, 'D1');
              insertCallDataRecord('Web', vrsNum, evt.uniqueid, 'D1');

              // mapped consumer extension to a vrs num. so now we can finally pop
              popZendesk(evt.destuniqueid, vrsNum, destExtension[1], destExtension[1], '', '', '', '');

              vrsAndZenLookup(Number(vrsNum), Number(destExtension[1]));
            } else if (isOurPhone) {
              vrsAndZenLookup(Number(extension[1]), Number(destExtension[1]));
              io.to(Number(destExtension[1])).emit('no-ticket-info', {});
              console.log(`OUR PHONE ${extension[1]}`);
            } else {
              // Trigger to agent to indicate that we don't have a valid VRS,
              // agent will prompt user for VRS
              io.to(Number(destExtension[1])).emit('missing-vrs', {});
              console.log('MISSING VRS NUMBER ');
            }
          });

          // tell CSR portal that a complaints queue call has connected
          io.to(Number(destExtension[1])).emit('new-caller-complaints', evt.context);
        } else if (evt.context === 'Provider_General_Questions' || evt.context === 'General_Questions') {
          /*
           * This case occurs when a user calls from a Zphone and presses
           * option #4.
           */
          // Case #4

          /*
           * For the general questions queue, we do the following:
           * - Get the extension number (destchannel field?)
           * - Create an entry in the linphoneToAgentMap
           *     (linphone extension => dest agent extension)
           * - Emit a missing-vrs message to the correct agent portal
           *     (we don't have VRS for the Linphone caller)
           * - Emit a new-caller-general to the correct agent portal
           */

          // console.log("INSERTING HARDWARE OR SOFTPHONE CALL HANDLED");
          insertCallDataRecord('Handled', evt.calleridnum, evt.uniqueid, 'D2');

          if (JSON.stringify(evt.channel).indexOf(PROVIDER_STR) !== -1) {
            // This is a Zphone or Sorenson call

            logger.info(`DialEnd processing from a General Questions queue call. evt.context is: ${evt.context} , evt.channel is: ${evt.channel}`);

            // Format is PJSIP/ZVRS-xxxxxx or PJSIP/Sorenson2-nnnnnn,
            // we want to strip out the xxxxxx only
            const extString = evt.channel;
            const extension = extString.split(/[\/,-]/);
            let callType = null;

            logger.info(`extension[1] is >${extension[1]}<`);
            if (extension[1].startsWith(PROVIDER_STR)) {
              callType = extension[1];
              logger.info(`Matched on ${extension[1]}, setting extension[1] to ${evt.calleridnum}`);
              extension[1] = evt.calleridnum;
            }

            const destExtString = evt.destchannel;
            const destExtension = destExtString.split(/[\/,-]/);
            redisClient.hset(c.R_CONSUMER_TO_CSR, Number(extension[1]), Number(destExtension[1]));
            logger.info(`Populating consumerToCsr: ${extension[1]} => ${destExtension[1]}`);
            logger.info(`Extension number: ${extension[1]}`);
            logger.info(`Dest extension number: ${destExtension[1]}`);

            // pop zendesk
            if (extension[1].length >= 10) {
              // pop here, because we already have the consumer phone number
              popZendesk(evt.destuniqueid, extension[1], destExtension[1], destExtension[1], '', '', '', '');
            }

            redisClient.hget(c.R_EXTENSION_TO_VRS, Number(extension[1]), (err, vrsNum) => {
              if (!err && vrsNum) {
                // Call new function
                logger.info(`Calling vrsAndZenLookup with ${vrsNum} and ${destExtension[1]}`);

                // mapped consumer extension to a vrs num. so now we can finally pop
                popZendesk(evt.destuniqueid, vrsNum, destExtension[1], destExtension[1], '', '', '', '');

                vrsAndZenLookup(Number(vrsNum), Number(destExtension[1]));
              } else if (callType.startsWith(PROVIDER_STR) && extension[1] !== null) {
                vrsAndZenLookup(Number(extension[1]), Number(destExtension[1]));
                io.to(Number(destExtension[1])).emit('no-ticket-info', {});
              } else {
                // Trigger to agent to indicate that we don't have a valid VRS,
                // agent will prompt user for VRS
                io.to(Number(destExtension[1])).emit('missing-vrs', {});
              }
            });
            // tell CSR portal that a complaints queue call has connected
            io.to(Number(destExtension[1])).emit('new-caller-general', evt.context);
          } else {
            // This is a Linphone call
            logger.info(`DialEnd processing from a General Questions queue call, but UNKNOWN DEVICE. evt.context is: ${evt.context} , evt.channel is: ${evt.channel}`);
            logger.info('Proceeding anyway...');
            const agentString = evt.destchannel;
            const agentExtension = agentString.split(/[\/,-]/);
            const linphoneString = evt.channel;
            const linphoneExtension = linphoneString.split(/[\/,-]/);

            logger.info(`Adding to linphoneToAgentMap: ${Number(linphoneExtension[1])} =>${agentExtension[1]}`);

            redisClient.hset(c.R_LINPHONE_TO_AGENT_MAP, Number(linphoneExtension[1]),
              Number(agentExtension[1]));

            logger.info(`Sending new-caller-general to agent: ${agentExtension[1]}`);

            // Trigger to agent to indicate that we don't have a valid VRS,
            // agent will prompt user for VRS
            io.to(Number(agentExtension[1])).emit('missing-vrs', {});
            io.to(Number(agentExtension[1])).emit('new-caller-general', evt.context);

            /** HOT FIX NOT IN GITHUB; MUST CARRY FORWARD */
            if (evt.calleridnum) {
              popZendesk(evt.destuniqueid, evt.calleridnum, agentExtension[1], agentExtension[1], '', '', '', '');

              // Save handled call??? What is in calleridnum ?
              // insertCallDataRecord("Handled", evt.calleridnum, evt.uniqueid);
            }
            /** HOT FIX NOT IN GITHUB; MUST CARRY FORWARD */
          }
        } else {
          // if we don't recognize the evt.context, then we will assume a web call (and allow chat)
          logger.info(`DialEnd processing from a UNKNOWN queue call. evt.context is: ${evt.context} , evt.channel is: ${evt.channel}`);

          // Format is PJSIP/nnnnn-xxxxxx, we want to strip out the nnnnn only
          var extString = evt.channel;
          var extension = extString.split(/[\/,-]/);
          let isOurPhone = false;

          // is this one of our phones? one that we expect?
          if (extension[1].startsWith(PROVIDER_STR)) {
            isOurPhone = true;
            logger.info(`Matched on ${extension[1]}, setting extension[1] to ${evt.calleridnum}`);
            extension[1] = evt.calleridnum;
          } else {
            logger.info(`No phone match, but this could be a WebRTC extension: ${extension[1]}. leaving extension[1] alone to continue processing...`);
          }

          const destExtString = evt.destchannel;
          const destExtension = destExtString.split(/[\/,-]/);
          redisClient.hset(c.R_CONSUMER_TO_CSR, Number(extension[1]), Number(destExtension[1]));
          logger.info(`Populating consumerToCsr: ${extension[1]} => ${destExtension[1]}`);
          logger.info(`Extension number: ${extension[1]}`);
          logger.info(`Dest extension number: ${destExtension[1]}`);

          if (extension[1].length >= 10) {
            // pop here, because we already have the consumer phone number
            popZendesk(evt.destuniqueid, extension[1], destExtension[1], destExtension[1], '', '', '', '');
          }

          redisClient.hget(c.R_EXTENSION_TO_VRS, Number(extension[1]), (err, vrsNum) => {
            if (!err && vrsNum) {
              // Call new function
              logger.info(`Calling vrsAndZenLookup with ${vrsNum} and ${destExtension[1]}`);

              insertCallDataRecord('Handled', vrsNum, evt.uniqueid, 'D3');

              // mapped consumer extension to a vrs num. so now we can finally pop
              popZendesk(evt.destuniqueid, vrsNum, destExtension[1], destExtension[1], '', '', '', '');

              vrsAndZenLookup(Number(vrsNum), Number(destExtension[1]));
            } else if (isOurPhone) {
              vrsAndZenLookup(Number(extension[1]), Number(destExtension[1]));
              io.to(Number(destExtension[1])).emit('no-ticket-info', {});
            } else {
              // Trigger to agent to indicate that we don't have a valid VRS,
              // agent will prompt user for VRS
              io.to(Number(destExtension[1])).emit('missing-vrs', {});
            }
          });
          // tell CSR portal that a complaints queue call has connected
          io.to(Number(destExtension[1])).emit('new-caller-complaints', evt.context);
        }
      }

      break;

    // Sent by Asterisk when the caller hangs up
    case ('Hangup'):
      var extString = evt.channel;
      var extension = extString.split(/[\/,-]/);

      logger.info(`HANGUP RECEIVED: evt.context:${evt.context} , evt.channel:${evt.channel}`);
      logger.info(`HANGUP RECEIVED calleridnum: ${evt.calleridnum}`);

        if(extension[1] && !isNaN(extension[1])){
        redisClient.hget(c.R_CONSUMER_EXTENSIONS, Number(extension[1]), (err, reply) => {
            if (err) {
              logger.error(`Redis Error${err}`);
            } else if (reply) {
              console.log(extension[1] + " available for reuse.")
              const val = JSON.parse(reply);
              val.inuse = false;
              redisClient.hset(c.R_CONSUMER_EXTENSIONS, Number(extension[1]), JSON.stringify(val));
	    }
          });
        }

      if (evt.context === 'Provider_Videomail') {
        console.log(`VIDOEMAIL evt: ${JSON.stringify(evt, null, 2)}`);
        insertCallDataRecord('Videomail', evt.calleridnum, evt.uniqueid, 'D4');
      } else if (evt.connectedlinenum === queuesComplaintNumber
        || evt.exten === queuesComplaintNumber) {
        // Consumer portal ONLY! Zphone Complaint queue calls will go to the next if clause
        logger.info('Processing Hangup from a Complaints queue call');
        logger.info(`HANGUP RECEIVED COMPLAINTS QUEUE calleridnum: ${evt.calleridnum}`);

        if (evt.context === 'from-internal' && evt.channelstatedesc === 'Ringing') {
          // this is a missed call from the consumer portal
          const channelStr = evt.channel;
          const agentExtension = (channelStr.split(/[\/,-]/))[1];

          logger.info('**********************************');
          logger.info('**********************************');
          logger.info('**********************************');
          logger.info('**********************************');
          logger.info('');
          logger.info(`Abandoned call for agent: ${agentExtension}`);
          logger.info('');
          logger.info('**********************************');
          logger.info('**********************************');
          logger.info('**********************************');
          logger.info('**********************************');

          // this agent(agentExtension) must now go to away status
          console.log(`${agentExtension} missed a call from the consumer portal`);
          io.to(Number(agentExtension)).emit('new-missed-call', { max_missed: getConfigVal('missed_calls:max_missed_calls') }); // should send missed call number
          redisClient.hget(c.R_TOKEN_MAP, agentExtension, (err, tokenMap) => {
            if (err) {
              logger.error(`Redis Error: ${err}`);
            } else {
              tokenMap = JSON.parse(tokenMap);
              if (tokenMap !== null && tokenMap.token) {
                redisClient.hset(c.R_TOKEN_MAP, tokenMap.token, 'MISSEDCALL');
              }
            }
          });
        } else {
          // regular consumer portal hangup
          if (extension[1].startsWith(PROVIDER_STR)) {
            extension[1] = evt.calleridnum;
            logger.info(`Matched on ZVRS, setting extension[1] to ${evt.calleridnum}`);
          }

          logger.info(`Hangup extension number: ${extension[1]}`);

          redisClient.hget(c.R_CONSUMER_EXTENSIONS, Number(extension[1]), (err, reply) => {
            if (err) {
              logger.error(`Redis Error${err}`);
            } else if (reply) {
              const val = JSON.parse(reply);
              val.inuse = false;
              redisClient.hset(c.R_CONSUMER_EXTENSIONS, Number(extension[1]), JSON.stringify(val));
            }
          });

          logger.info('extensionToVrs contents:');
          redisClient.hgetall(c.R_EXTENSION_TO_VRS, (err, reply) => {
            for (const id in reply) {
              logger.info(`id: ${id}`);
            }
          });

          redisClient.hexists(c.R_EXTENSION_TO_VRS, Number(extension[1]), (err, reply) => {
            if (reply === 1) {
              logger.info(`extensionToVrsMap contains ${extension[1]}`);
            } else {
              logger.info(`extensionToVrsMap does not contain ${extension[1]}`);
            }
          });

          redisClient.hget(c.R_EXTENSION_TO_VRS, Number(extension[1]), (err, vrsNum) => {
            if (!err && vrsNum) {
              logger.info(`Sending chat-leave for socket id ${vrsNum}`);
              io.to(Number(vrsNum)).emit('chat-leave', {
                vrs: vrsNum
              });

              // Remove the extension when we're finished
              redisClient.hdel(c.R_EXTENSION_TO_VRS, Number(extension[1]));
              redisClient.hdel(c.R_EXTENSION_TO_VRS, Number(vrsNum));
            } else {
              logger.error("Couldn't find VRS number in extensionToVrs map for extension ");
            }
          });
        }
      } else if (evt.context === 'Provider_General_Questions' || evt.context === 'General_Questions' || evt.context === 'Provider_Complaints' || evt.context === 'Complaints') {
        // This Provider context check for this block of code may be obsolete.
        // Not call transfer
        // Zphone option #4 or 5
        logger.info(`HANGUP Zphone option 4 or 5 calleridnum: ${evt.calleridnum}`);

        const linphoneString = evt.channel;
        const linphoneExtension = linphoneString.split(/[\/,-]/);

        logger.info('Processing Hangup for a Provider_General_Questions queue call');
        logger.info(`Linphone extension number: ${linphoneExtension[1]}`);

        var agentExtension = 0;

        redisClient.hget(c.R_LINPHONE_TO_AGENT_MAP, Number(linphoneExtension[1]),
          (err, agentExtension) => {
            if (agentExtension !== null) {
              // Remove the entry
              redisClient.hdel(c.R_LINPHONE_TO_AGENT_MAP, Number(linphoneExtension[1]));
            } else {
              redisClient.hget(c.R_CONSUMER_TO_CSR, Number(evt.calleridnum), (_err, _agentExtension) => {
                // Remove c.R_CONSUMER_TO_CSR redis map on hangups.
                redisClient.hdel(c.R_CONSUMER_TO_CSR, Number(evt.calleridnum));
              });
            }
          });
      } else if (evt.context === 'from-internal' && evt.connectedlinenum === queuesVideomailNumber) {
        logger.info('Processing Hangup from a WebRTC Videomail call (Consumer hangup)');
        logger.info(`VIDEOMAIL WebRTC HANGUP calleridnum: ${evt.calleridnum}`);

        redisClient.hget(c.R_CONSUMER_EXTENSIONS, Number(evt.calleridnum), (err, reply) => {
          if (err) {
            logger.error(`Redis Error${err}`);
          } else if (reply) {
            const val = JSON.parse(reply);
            val.inuse = false;
            redisClient.hset(c.R_CONSUMER_EXTENSIONS, Number(evt.calleridnum), JSON.stringify(val));
          }
        });

        logger.info('extensionToVrs contents:');
        redisClient.hgetall(c.R_EXTENSION_TO_VRS, (err, reply) => {
          for (const id in reply) {
            logger.info(`id: ${id}`);
          }
        });

        redisClient.hexists(c.R_EXTENSION_TO_VRS, Number(evt.calleridnum), (err, reply) => {
          if (reply === 1) {
            logger.info(`extensionToVrsMap contains ${evt.calleridnum}`);
          } else {
            logger.info(`extensionToVrsMap does not contain ${evt.calleridnum}`);
          }
        });

        redisClient.hget(c.R_EXTENSION_TO_VRS, Number(evt.calleridnum), (err, vrsNum) => {
          if (!err && vrsNum) {
            console.log(`VIDOEMAIL WebRTC evt: ${JSON.stringify(evt, null, 2)}`);
            insertCallDataRecord('Videomail', vrsNum, evt.uniqueid, 'D5');

            // Remove the extension when we're finished
            redisClient.hdel(c.R_EXTENSION_TO_VRS, Number(evt.calleridnum));
            redisClient.hdel(c.R_EXTENSION_TO_VRS, Number(vrsNum));
          } else {
            logger.error("Couldn't find VRS number in extensionToVrs map for extension ");
          }
        });
      } else if (evt.context === 'from-internal') {
        if (evt.channelstatedesc === 'Ringing') {
          // this is an abandoned call
          const channelStr = evt.channel;
          var agentExtension = (channelStr.split(/[\/,-]/))[1];

          logger.info('**********************************');
          logger.info('**********************************');
          logger.info('**********************************');
          logger.info('**********************************');
          logger.info('');
          logger.info(`Abandoned call for agent: ${agentExtension}`);
          logger.info('');
          logger.info('**********************************');
          logger.info('**********************************');
          logger.info('**********************************');
          logger.info('**********************************');

          // calleridnum is for agent, connectedlinenum is for caller
          logger.info(`HANGUP RECEIVED ABANDONED CALL calleridnum & : connectedlinenum${evt.calleridnum} connectedlinenum ${evt.connectedlinenum}`);
          insertCallDataRecord('Abandoned', evt.connectedlinenum, evt.uniqueid, 'D6');

          // this agent(agentExtension) must now go to away status
          io.to(Number(agentExtension)).emit('new-missed-call', { max_missed: getConfigVal('missed_calls:max_missed_calls') }); // should send missed call number
          redisClient.hget(c.R_TOKEN_MAP, agentExtension, (err, tokenMap) => {
            if (err) {
              logger.error(`Redis Error: ${err}`);
            } else {
              tokenMap = JSON.parse(tokenMap);
              if (tokenMap !== null && tokenMap.token) redisClient.hset(c.R_TOKEN_MAP, tokenMap.token, 'MISSEDCALL');
            }
          });
        } else {
          // transferred consumer portal call hanging up
          redisClient.hget(c.R_CONSUMER_EXTENSIONS, Number(extension[1]), (err, reply) => {
            if (err) {
              logger.error(`Redis Error${err}`);
            } else if (reply) {
              const val = JSON.parse(reply);
              val.inuse = false;
              redisClient.hset(c.R_CONSUMER_EXTENSIONS, Number(extension[1]), JSON.stringify(val));
            }
          });

          redisClient.hget(c.R_EXTENSION_TO_VRS, Number(extension[1]), (err, vrsNum) => {
            if (!err && vrsNum) {
              logger.info(`Sending chat-leave for socket id ${vrsNum}`);
              io.to(Number(vrsNum)).emit('chat-leave', {
                vrs: vrsNum
              });

              // Remove the extension when we're finished
              redisClient.hdel(c.R_EXTENSION_TO_VRS, Number(extension[1]));
              redisClient.hdel(c.R_EXTENSION_TO_VRS, Number(vrsNum));
            } else {
              logger.error("Couldn't find VRS number in extensionToVrs map for extension ");
            }
          });
        }
      } else if (evt.context === 'from-phones') {
        if (evt.channelstatedesc === 'Busy') {
          // This is a hangup from an outbound call that did not connect (i.e., Busy)
          logger.info(`Extension ${extension[1]} tried an outbound call, but it did not connect. Emitting chat-leave...`);
          io.to(Number(extension[1])).emit('chat-leave', {
            extension: extension[1],
            vrs: ''
          });
        }
      } else {
        // if we get here, it is a hangup that we are ignoring, probably because we don't need it
        logger.info(`Not processing hangup.  evt string values... evt.context:${evt.context} , evt.channel:${evt.channel}`);
        logger.info(`HANGUP RECEIVED IGNORING calleridnum: ${evt.calleridnum}`);
        console.log('ignoring hangup');
      }

      break;

    // Sent by Asterisk when a call is transferred
    case ('AttendedTransfer'):
      logger.info('Processing AttendedTransfer');

      var extString = evt.origtransfererchannel;
      var extension = extString.split(/[\/,-]/);

      logger.info(`Received a transfer request from: ${extension[1]} to: ${evt.secondtransfererexten}`);
      logger.info(`Caller extension: ${evt.origtransfererconnectedlinenum}`);
      logger.info(`Queue name: ${evt.transfereecontext}`);

      redisClient.hexists(c.R_CONSUMER_EXTENSIONS, Number(evt.origtransfererconnectedlinenum),
        (errHexists, reply) => {
          if (errHexists) {
            logger.error(`Redis Error${errHexists}`);
          } else if (reply === 1 && evt.transfereecontext === 'Complaints') {
            // WebRTC call
            logger.info('Received a WebRTC transfer');

            /*
               * Need to send the following:
               *  - new-caller-complaints
               *  - ad-vrs
               *  - ad-zendesk
               *  - chat-leave (Maybe change to call end)
               */

            /*
               * Get the original extension number so we can look up the corresponding VRS.
               */
            const origExtString = evt.origtransfererchannel;
            const origExtension = origExtString.split(/[\/,-]/);

            // Use the origExtension to look up the VRS number.
            redisClient.hget(c.R_EXTENSION_TO_VRS, Number(evt.origtransfererconnectedlinenum),
              (errHget, vrsNum) => {
                if (errHget) {
                  logger.error(`Redis Error${errHget}`);
                } else {
                  /*
                     * First find the destination channel (who we are transferring to),
                     * should look like this:
                     * transfertargetchannel: 'PJSIP/nnnnn-00000031
                     * We only want the nnnnn extension to for a Socket.IO endpoint
                     */
                  const destExtString = evt.transfertargetchannel;
                  const destExtension = destExtString.split(/[\/,-]/);

                  // Tell the CSR portal that a complaints queue call has connected
                  io.to(Number(destExtension[1])).emit('new-caller-complaints', evt.context);

                  // Calling the lookup with the VRS and extension,
                  // we should generate the ad-vrs and ad-zendesk
                  // function vrsAndZenLookup(vrsNum, destAgentExtension) {
                  vrsAndZenLookup(vrsNum, Number(destExtension[1]));

                  io.to(Number(origExtension[1])).emit('chat-leave', {
                    vrs: vrsNum
                  });
                }
              });
          } else if (evt.transfereecontext === 'Provider_General_Questions' || evt.transfereecontext === 'General_Questions') {
            // Zphone #4
            logger.info('Received a Zphone transfer - general questions');

            const destExtension = evt.secondtransfererconnectedlinenum;

            logger.info(`destExtension: ${destExtension}`);

            io.to(Number(destExtension)).emit('no-ticket-info', {});

            logger.info(`Sending no-ticket-info to: ${destExtension}`);

            // Tell CSR portal that a complaints queue call has connected
            io.to(Number(destExtension)).emit('new-caller-general', evt.context);
            logger.info(`Sending new-caller-general to: ${destExtension}`);

            logger.info(`Calling vrsAndZenLookup() for: ${evt.origtransfererconnectedlinenum},${destExtension}`);
            vrsAndZenLookup(evt.origtransfererconnectedlinenum, Number(destExtension));

            io.to(Number(evt.origtransfererconnectedlinenum)).emit('chat-leave', {
              vrs: evt.origtransfererconnectedlinenum
            });
            logger.info(`Sending chat-leave to: ${evt.origtransfererconnectedlinenum}`);

            // Need to update the consumerToCsr map so that the chat-leave goes to the right agent
            redisClient.hexists(c.R_CONSUMER_TO_CSR, Number(evt.origtransfererconnectedlinenum),
              (err, reply) => {
                if (reply === 1) {
                  redisClient.hset(c.R_CONSUMER_TO_CSR, Number(evt.origtransfererconnectedlinenum),
                    Number(evt.secondtransfererconnectedlinenum));
                  logger.info(`Inside if(), updating consumerToCsr hash with: ${evt.origtransfererconnectedlinenum} => ${evt.secondtransfererconnectedlinenum}`);
                }
              });
          } else if (evt.transfereecontext === 'Provider_Complaints' || evt.transfereecontext === 'Complaints') {
            // Zphone #5

            logger.info('Received a Zphone transfer - provider');

            var destExtension = evt.secondtransfererconnectedlinenum;
            logger.info(`destExtension: ${destExtension}`);

            io.to(Number(destExtension)).emit('no-ticket-info', {});

            logger.info(`Sending no-ticket-info to: ${destExtension}`);

            // Tell CSR portal that a complaints queue call has connected
            io.to(Number(destExtension)).emit('new-caller-complaints', evt.context);

            logger.info(`Sending new-caller-complaints to: ${destExtension}`);

            logger.info(`Calling vrsAndZenLookup() for: ${evt.origtransfererconnectedlinenum},${destExtension}`);
            vrsAndZenLookup(evt.origtransfererconnectedlinenum, Number(destExtension));

            io.to(Number(evt.origtransfererconnectedlinenum)).emit('chat-leave', {
              vrs: evt.origtransfererconnectedlinenum
            });

            logger.info(`Sending chat-leave to: ${evt.origtransfererconnectedlinenum}`);

            // Need to update the consumerToCsr map so that the chat-leave goes to the right agent
            redisClient.hexists(c.R_CONSUMER_TO_CSR, Number(evt.origtransfererconnectedlinenum),
              (err, reply) => {
                if (reply === 1) {
                  redisClient.hset(c.R_CONSUMER_TO_CSR, Number(evt.origtransfererconnectedlinenum),
                    Number(evt.secondtransfererconnectedlinenum));
                  logger.info(`Inside if(), updating consumerToCsr hash with: ${evt.origtransfererconnectedlinenum} => ${evt.secondtransfererconnectedlinenum}`);
                }
              });
          } else if (evt.transfereecontext === 'Linphone') {
            // Need to see what this means
          } else {
            logger.info('Unable to identify transferred call');
          }
        });

      break;

    // Sent by Asterisk when a phone rings
    case ('Newstate'):
      logger.info('Processing Newstate');
      // channelstate: 5 equals "Ringing"
      if (evt.channelstate === '5') {
        // Format is PJSIP/nnnnn-xxxxxx, we want to strip out the nnnnn only
        var extString = evt.channel;
        var extension = extString.split(/[\/,-]/)[1];
        const callerExt = evt.connectedlinenum;

        redisClient.hget(c.R_EXTENSION_TO_VRS, Number(callerExt), (errHget, phoneNum) => {
          if (errHget) {
            logger.error(`Redis Error: ${errHget}`);
          } else {
            if (!phoneNum) phoneNum = callerExt;
            logger.info(`New caller Ringing: to:${extension}, from: ${phoneNum}`);
            io.to(Number(extension)).emit('new-caller-ringing', {
              phoneNumber: phoneNum
            });

            redisClient.hget(c.R_TOKEN_MAP, extension, (err, tokenMap) => {
              if (err) {
                logger.error(`Redis Error: ${err}`);
              } else {
                tokenMap = JSON.parse(tokenMap);
                if (tokenMap !== null && tokenMap.token) redisClient.hset(c.R_TOKEN_MAP, tokenMap.token, 'INCOMINGCALL');
              }
            });
          }
        });
      }
      break;

    // sent by asterisk when a caller leaves the queue before they were connected
    case ('QueueCallerAbandon'):
      var data = { position: evt.position, extension: evt.calleridnum, queue: evt.queue };
      sendEmit('queue-caller-abandon', data);

      console.log(`ABANDONED evt: ${JSON.stringify(evt, null, 2)}`);

      const ext = evt.calleridnum;
      let vrs;
      redisClient.hget(c.R_EXTENSION_TO_VRS, Number(ext), (err, vrsNum) => {
        if (!err && vrsNum) {
          logger.info(`ABANDONED WebRTC VRS NUMBER ${vrsNum}`);
          vrs = vrsNum;

          insertCallDataRecord('Abandoned', vrs, evt.uniqueid, 'D7');
        }
      });

      break;
    // sent by asterisk when a caller joins the queue
    case ('QueueCallerJoin'):
      if (evt.queue === 'ComplaintsQueue') complaintQueueCount = evt.count;
      if (evt.queue === 'GeneralQuestionsQueue') generalQueueCount = evt.count;
      var data = {
        position: evt.position,
        extension: evt.calleridnum,
        queue: evt.queue,
        count: evt.count
      };
      sendEmit('queue-caller-join', data);
      break;
    // sent by aasterisk a caller leaves the queue (either by abandoning or being connected)
    case ('QueueCallerLeave'):
      if (evt.queue === 'ComplaintsQueue') complaintQueueCount = evt.count;
      if (evt.queue === 'GeneralQuestionsQueue') generalQueueCount = evt.count;
      var data = {
        position: evt.position,
        extension: evt.calleridnum,
        queue: evt.queue,
        count: evt.count
      };
      sendEmit('queue-caller-leave', data);
      break;

    default:
      logger.warn(`AMI unhandled event: ${evt.event}`);
      break;
  }
}

/**
 * Instantiate the Asterisk connection.
 * @returns {undefined} Not used
 */
function init_ami() {
  if (ami === null) {
    try {
      ami = new asteriskManager(getConfigVal('app_ports:asterisk_ami').toString(),
        getConfigVal('servers:asterisk_private_ip'),
        getConfigVal('asterisk:ami:id'),
        getConfigVal('asterisk:ami:passwd'), true);
      ami.keepConnected();

      // Define event handlers here

      // add only the manager ami events we care about
      // ami.on('managerevent', handleManagerEvent);
      ami.on('dialend', handleManagerEvent);
      ami.on('varset', handleManagerEvent);
      ami.on('hangup', handleManagerEvent);
      ami.on('attendedtransfer', handleManagerEvent);
      ami.on('newstate', handleManagerEvent);
      ami.on('queuecallerabandon', handleManagerEvent);
      ami.on('queuecallerjoin', handleManagerEvent);
      ami.on('queuecallerleave', handleManagerEvent);

      // for Asterisk health
      ami.on('end', ()=>{
        sendEmit('asterisk-ami-check', 'ERROR - AMI connection end.');
      });
      ami.on('close', (c,d)=>{
        sendEmit('asterisk-ami-check', 'ERROR - AMI connection close.');
      });      

      // handle the response
      ami.on('response', handleActionResponse);

      logger.info('Connected to Asterisk');
    } catch (exp) {
      logger.error('Init AMI error');
    }
  }
}

/**
 * Initialize the AMI connection.
 */
init_ami();

// polling methods

// for the consumer portal when a customer is waiting in queue
// and no agents are available (i.e., not AWAY)
setInterval(() => {
  redisClient.hgetall(c.R_AGENT_INFO_MAP, (err, data) => {
    if (data) {
      let agentsLoggedIn = false;
      for (const prop in data) {
        if (Object.prototype.hasOwnProperty.call(data, prop)) {
          const obj = JSON.parse(data[prop]);
          let astatus = obj.status;
          astatus = astatus.toUpperCase();
          if (astatus !== 'AWAY') {
            agentsLoggedIn = true;
            break;
          }
        }
      }
      sendEmit('agents', { agentsLoggedIn });
    } else {
      sendEmit('agents', { agentsLoggedIn: false });
    }
  });
}, 5000);

setInterval(() => {
  // Keeps connection from Inactivity Timeout
  dbConnection.ping();
}, 60000);

setInterval(() => {
  // query for after hours
  const ohurl = `https://${getConfigVal('servers:main_private_ip')}:${parseInt(getConfigVal('app_ports:mserver'), 10)}/operatinghours`;
  request({
    method: 'GET',
    url: ohurl,
    headers: {
      'Content-Type': 'application/json'
    },
    json: true
  }, (error, response, data) => {
    if (error) {
      logger.error(`GET operatinghours: ${error}`);
    } else {
      isOpen = data.isOpen;

      // operating hours
      startTimeUTC = data.start; // hh:mm in UTC
      endTimeUTC = data.end; // hh:mm in UTC
    }
    sendEmit('call-center-closed', { closed: !isOpen });
  });

  // asterisk checks
  const asteriskIp = getConfigVal('servers:asterisk_private_ip');
  const amiId = getConfigVal('asterisk:ami:id');
  const amiPass = getConfigVal('asterisk:ami:passwd');
  const amiPort = getConfigVal('app_ports:asterisk_ami').toString();
  checkAsterisk(asteriskIp, amiId, amiPass, amiPort);

}, 5000);

// AMI Ping for status and keepalive
setInterval(() => { ami.action({Action: "Ping", actionid: AMI_PING_ID}); }, AMI_PING_MS);

/**
 * Removes the interface (e.g. SIP/6001) from Asterisk when the agent logs out.
 *
 * @param {type} token Session token for this user.
 * @returns {undefined} N/A
 */
function logout(token) {
  // removes username from statusMap
  if (token.username !== null) {
    redisClient.hdel(c.R_STATUS_MAP, token.username);
    redisClient.hdel(c.R_AGENT_INFO_MAP, token.username);
    if (token.lightcode) redisClient.hset(c.R_TOKEN_MAP, token.lightcode, 'OFFLINE');

    sendAgentStatusList();

    // Note, we need to remove from both queues, same extension.
    if (token.queue_name) {
      logger.info(`REMOVING QUEUE: PJSIP/${token.extension}, queue name ${token.queue2_name}`);

      ami.action({
        Action: 'QueueRemove',
        Interface: `PJSIP/${token.extension}`,
        Paused: 'true',
        Queue: token.queue_name
      }, (_err, _res) => { });
    }

    if (token.queue2_name) {
      logger.info(`REMOVING QUEUE: PJSIP/${token.extension}, queue name ${token.queue2_name}`);

      ami.action({
        Action: 'QueueRemove',
        Interface: `PJSIP/${token.extension}`,
        Paused: 'true',
        Queue: token.queue2_name
      }, (_err, _res) => { });
    }
  }
}


/**
 * Makes a REST call to retrieve the script associated with the specified
 * queueName (e.g. InboundQueue) and queueType (e.g. General).
 *
 * @param {type} queueName Name of the queue.
 * @param {type} queueType Type of queue.
 * @param {type} callback
 * @returns {undefined} N/A
 */
function getScriptInfo(queueName, queueType, _callback) {
  let url = `https://${getConfigVal('servers:main_private_ip')}:${getConfigVal('app_ports:mserver')}`;

  if (queueType && queueName) {
    url += `/getscript/?queue_name=${queueType}&type=${queueName}`;

    request({
      url,
      json: true
    }, (error, response, data) => {
      if (error) {
        logger.error('ERROR: from /getscript/');
        data = {
          message: 'failed'
        };
      } else {
        logger.info(`Script lookup response: ${data.message}${JSON.stringify(data.data[0])}`);
      }
    });
  }
}

/**
 * Do the following here:
 * 1. Lookup and verify VRS number, retrieve VRS data
 * 2. Create Zendesk ticket, retrieve ID
 * 3. Send VRS data and Zendesk ticket ID back to consumer
 *
 * @param {type} data JSON data coming from consumer
 * @returns {undefined}
 */
function processConsumerRequest(data) {
  let resultJson = {};

  logger.info(`processConsumerRequest - incoming ${JSON.stringify(data)}`);

  // Do the VRS lookup first
  utils.getCallerInfo(data.vrs, (vrsinfo) => {
    if (vrsinfo.message === 'success') {
      logger.info('Config lookup:');
      logger.info(`queuesComplaintNumber: ${queuesComplaintNumber}`);

      logger.info(`VRS contents: ${JSON.stringify(vrsinfo)}`);

      /*
       * If we get here, we have a valid VRS lookup. Extract the
       * data to send back to the consumer portal. Note, the data.*
       * fields are coming from the initial request while the vrsinfo.*
       * fields are coming from the VRS lookup. We're merging the
       * two sources here.
       */
      let ticketId = 0;

      const ticket = {
        ticket: {
          subject: data.subject,
          description: data.description,
          requester: {
            name: vrsinfo.data[0].first_name,
            email: vrsinfo.data[0].email,
            phone: data.vrs,
            user_fields: {
              last_name: vrsinfo.data[0].last_name
            }
          }
        }
      };

      logger.info(`Populated ticket: ${JSON.stringify(ticket)}`);

      // Create a Zendesk ticket
      zendeskClient.tickets.create(ticket, (err, req, result) => {
        if (err) {
          logger.error('Zendesk create ticket failure');
          return handleError(err);
        }

        logger.info(JSON.stringify(result, null, 2, true));
        logger.info(`Ticket ID: ${result.id}`);

        ticketId = result.id;

        resultJson = {
          message: vrsinfo.message,
          vrs: vrsinfo.data[0].vrs,
          username: vrsinfo.data[0].username,
          first_name: vrsinfo.data[0].first_name,
          last_name: vrsinfo.data[0].last_name,
          address: vrsinfo.data[0].address,
          city: vrsinfo.data[0].city,
          state: vrsinfo.data[0].state,
          zip_code: vrsinfo.data[0].zip_code,
          email: vrsinfo.data[0].email,
          zendesk_ticket: ticketId,
          subject: data.subject,
          description: data.description,
          queues_complaint_number: queuesComplaintNumber
        };

        logger.info(`vrsToZenId map addition: ${data.vrs} => ${ticketId}`);
        logger.info(`EMIT: ad-ticket-created: ${JSON.stringify(resultJson)}`);

        redisClient.hset(c.R_VRS_TO_ZEN_ID, vrsinfo.data[0].vrs, ticketId);

        io.to(Number(vrsinfo.data[0].vrs)).emit('ad-ticket-created', resultJson);
      });
    } else {
      logger.warn('Consumer portal VRS lookup failed');

      // Send this back to the portal via Socket.IO
      resultJson = {
        message: 'failure'
      };

      io.to('my room').emit('ad-ticket-created', resultJson);
      logger.info(`EMIT: ad-ticket-created: ${resultJson}`);
    }
  });
}

/**
 * Update an existing Zendesk ticket.
 *
 * @param {type} data Ticket data
 * @returns {undefined} N/A
 */
function updateZendeskTicket(data) {
  const { ticketId } = data;

  const ticket = {
    ticket: {
      subject: data.subject,
      description: data.description,
      requester: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        user_fields: {
          last_name: data.last_name
        }
      },
      status: data.status,
      comment: data.comment,
      resolution: data.resolution
    }
  };

  logger.info(`\n****** Zendesk update in ticket: ${JSON.stringify(ticket)}`);
  logger.info(`\n****** Zendesk update in data: ${JSON.stringify(data)}`);

  // Update a Zendesk ticket
  zendeskClient.tickets.update(ticketId, ticket, (err, req, result) => {
    if (err) {
      logger.error('***** Zendesk update ticket failure');
      return handleError(err);
    }

    logger.info(`***** Zendesk update results: ${JSON.stringify(result)}`);

    logger.info('EMIT: ad-zendesk-update-success: ');
    io.to(Number(data.destexten)).emit('ad-zendesk-update-success', result);
  });
}

/**
 * Do the following here:
 * 1. Lookup next available JsSIP extension
 * 2. Send extension and password back to consumer for registration
 *
 * @param {type} data JSON data coming from consumer with vrs number
 * @returns {undefined}
 */
function processExtension(data) {
  let resultJson = {};

  logger.info(`processExtension - incoming ${JSON.stringify(data)}`);
  console.log(`processExtension - incoming ${JSON.stringify(data)}`);

  const asteriskPublicHostname = getConfigVal('servers:asterisk_fqdn');
  const stunServer = `${getConfigVal('servers:stun_fqdn')}:${getConfigVal('app_ports:stun')}`;

  // if wsPort is "", then it defaults to no port in the wss url
  let wsPort = getConfigVal('app_ports:asterisk_ws');
  if (wsPort !== '') {
    wsPort = parseInt(wsPort, 10);
  }

  const queuesVideomailNumber = getConfigVal('asterisk:queues:videomail:number');
  const queuesVideomailMaxrecordsecs = getConfigVal('videomail:max_record_secs');

  logger.info('Config lookup:');
  logger.info(`asteriskPublicHostname: ${asteriskPublicHostname}`);
  logger.info(`stunServer: ${stunServer}`);
  logger.info(`wsPort: ${wsPort}`);
  logger.info(`queuesComplaintNumber: ${queuesComplaintNumber}`);
  logger.info(`queuesVideomailNumber: ${queuesVideomailNumber}`);

  try {
    findNextAvailableExtension((nextExtension) => {
      findExtensionPassword(nextExtension, (extensionPassword) => {
        if (nextExtension === 0) {
          resultJson = { message: 'OutOfExtensions' };
        } else {
          resultJson = {
            message: 'success',
            vrs: data.vrs,
            extension: nextExtension,
            asterisk_public_hostname: asteriskPublicHostname,
            stun_server: stunServer,
            ws_port: wsPort,
            password: extensionPassword,
            signaling_server_url: signalingServerUrl,
            queues_complaint_number: queuesComplaintNumber,
            queues_videomail_number: queuesVideomailNumber,
            queues_videomail_maxrecordsecs: queuesVideomailMaxrecordsecs,
            complaint_redirect_active: complaintRedirectActive,
            complaint_redirect_desc: complaintRedirectDesc,
            complaint_redirect_url: complaintRedirectUrl
          };

          logger.info(`Extension to VRS Mapping: ${nextExtension} => ${data.vrs}`);

          redisClient.hset(c.R_EXTENSION_TO_VRS, Number(nextExtension), Number(data.vrs));
          redisClient.hset(c.R_EXTENSION_TO_VRS, Number(data.vrs), Number(nextExtension));
          if (data.language) {
            redisClient.hset(c.R_EXTENSION_TO_LANGUAGE, Number(nextExtension), data.language);
          } else {
            logger.error('Language has not been specified for extension', Number(nextExtension));
          }
        }

        logger.info(`EMIT: extension-created: ${JSON.stringify(resultJson)}`);
        io.to(Number(data.vrs)).emit('extension-created', resultJson);
      });
    });
  } catch (err) {
    logger.warn('Extension registration failed');
    // Send this back to the portal via Socket.IO
    resultJson = {
      message: 'failure'
    };

    io.to(Number(data.vrs)).emit('extension-created', resultJson);
    logger.info(`EMIT: extension-created: ${resultJson}`);
  }
}
/**
 *
 * @param {string} filter
 * @returns {boolean} filter formatted for mysql query
 */
function processFilter(filter) {
  if (filter === 'ALL') {
    return (false);
  }
  return (`'${filter}'`);
}

/**
 *
 * @param {type} err
 * @returns {undefined}
 */
function handleError(err) {
  console.log(err);
  process.exit(-1);
}


/**
 * sends an emit message for all connections.
 *
 * @returns {undefined}
 */
function sendEmit(evt, message) {
  try {
    io.sockets.emit(evt, message);
  } catch (exp) {
    logger.error('Socket io emit error ');
  }
}

/**
 * Populates the consumerExtensions hash map with a range of valid extensions.
 *
 * @returns {undefined} N/A
 */
function prepareExtensions() {
  const startExtension = getConfigVal('asterisk:extensions:start_number');
  const endExtension = getConfigVal('asterisk:extensions:end_number');
  const secret = getConfigVal('asterisk:extensions:secret');
  logger.info(`Extensions start: ${startExtension} end: ${endExtension}`);
  for (let num = parseInt(startExtension, 10); num <= parseInt(endExtension, 10); num += 1) {
    const data = {
      secret,
      inuse: false
    };
    redisClient.hset(c.R_CONSUMER_EXTENSIONS, Number(num), JSON.stringify(data));
  }
}

/**
 * Checks the consumerExtensions map and returns the next extension in the hash
 * map that isn't in use.
 *
 * @returns {Number} Next available extension.
 */
function findNextAvailableExtension(callback) {
  let nextExtension = 0;
  redisClient.hgetall(c.R_CONSUMER_EXTENSIONS, (err, reply) => {
    if (err) {
      logger.error(`Redis Error${err}`);
    } else if (reply) {
      for (const id in reply) {
        logger.info(`id: ${id}`);
        const val = JSON.parse(reply[id]);
        if (val.inuse === false) {
          logger.info(`Found an open extension in consumerExtensions: ${id}`);
          val.inuse = true;
          redisClient.hset(c.R_CONSUMER_EXTENSIONS, Number(id), JSON.stringify(val));
          nextExtension = id;
          break;
        }
      }
    }
    return callback(nextExtension);
  });
}

/**
 * Returns the Asterisk password from the consumerExtensions hash for the given extension.
 *
 * @param {Number} extension Incoming consumer extension number.
 * @returns {String} Asterisk password assigned to this extension.
 */

function findExtensionPassword(extension, callback) {
  logger.info(`Entering findExtensionPassword() for extension: ${extension}`);

  const passphrase = shortid.generate();
  let password = 'unknown';

  redisClient.hget(c.R_CONSUMER_EXTENSIONS, Number(extension), (err, reply) => {
    if (err) {
      logger.error(`Redis Error${err}`);
    } else if (reply) {
      logger.info('Found a match in the consumerExtensions map');
      const json = JSON.parse(reply);
      password = json.secret;
      redisClient.set(passphrase, password);
      redisClient.expire(passphrase, 5); // remove passphrase after 5 seconds.
    }
    callback(passphrase);
  });
}

/**
 * Perform VRS lookup and Zendesk ticket creation.
 *
 * @param {type} vrsNum Incoming VRS number.
 * @param {type} destAgentExtension Extension of the agent supporting this call.
 * @returns {undefined}
 */
function vrsAndZenLookup(vrsNum, destAgentExtension) {
  logger.info(`Performing VRS lookup for number: ${vrsNum} to agent ${destAgentExtension}`);
  console.log(`Performing VRS lookup for number: ${vrsNum} to agent ${destAgentExtension}`);

  if (vrsNum) {
    logger.info(`Performing VRS lookup for number: ${vrsNum} to agent ${destAgentExtension}`);
    incomingVRS = vrsNum; // for file share
    // Do the VRS lookup
    utils.getCallerInfo(vrsNum, (vrsinfo) => {
      logger.info(`vrsinfo: ${JSON.stringify(vrsinfo)}`);

      if (vrsinfo.message === 'success') {
        logger.info(`#### EMIT to room ${destAgentExtension}`);
        logger.info('VRS lookup success');
        logger.info(`#### EMIT VRS contents: ${JSON.stringify(vrsinfo)}`);

        // EMIT HERE ad-vrs
        io.to(Number(destAgentExtension)).emit('ad-vrs', vrsinfo);
      } else if (vrsinfo.message === 'vrs number not found') {
        logger.info('#### EMIT missing-vrs');
        io.to(Number(destAgentExtension)).emit('missing-vrs', vrsinfo);
      }
    });
  } else if (vrsNum === 0 || vrsNum === null) {
    logger.info('#### EMIT missing-vrs - blank case');
    io.to(Number(destAgentExtension)).emit('missing-vrs', {
      message: 'vrs number not found'
    });
  } else {
    logger.error('Could not find VRS in vrsAndZenLookup()');
  }

  redisClient.hget(c.R_VRS_TO_ZEN_ID, vrsNum, (_err, zenTicketId) => {
    if (zenTicketId) {
      logger.info(`Performing Zendesk ticket lookup for ticket: ${zenTicketId}`);

      zendeskClient.tickets.show(zenTicketId, (err, statusList, body,
        _responseList, _resultList) => {
        let resultJson = {
          message: 'failure'
        };
        if (err) {
          logger.error(`##### Zendesk error: ${err}`);
        } else {
          logger.info(`zendeskLookup() result: ${JSON.stringify(body, null, 2, true)}`);
          resultJson = body;
        }

        // emit here
        // EMIT HERE ad-zendesk
        logger.info(`#### EMIT to room: ${destAgentExtension}`);
        logger.info(`#### EMIT Zendesk show resultJson: ${JSON.stringify(resultJson)}`);
        io.to(Number(destAgentExtension)).emit('ad-zendesk', resultJson);
      });
    } else {
      logger.error('Could not find Zendesk ticket ID in vrsAndZenLookup()');
    }
  });
}

function setInitialLoginAsteriskConfigs(user) {
  logger.info(`queue_name: ${user.queue_name}`);
  logger.info(`queue2_name: ${user.queue2_name}`);

  const interfaceName = `PJSIP/${user.extension}`;
  const queueList = {
    queue_name: user.queue_name,
    queue2_name: user.queue2_name
  };

  // Keep agent info in memory for agent status calls.
  const agentInfo = {
    status: 'Away',
    username: user.username,
    name: `${user.first_name} ${user.last_name}`,
    extension: user.extension,
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
  redisClient.hset(c.R_AGENT_INFO_MAP, user.username, JSON.stringify(agentInfo));
  sendAgentStatusList(user.username, 'AWAY');
}

/**
 * Function to decode the Base64 configuration file parameters.
 * @param {type} encodedString Base64 encoded string.
 * @returns {unresolved} Decoded readable string.
 */
function decodeBase64(encodedString) {
  let decodedString = null;
  if (clearText) {
    decodedString = encodedString;
  } else {
    decodedString = Buffer.alloc(encodedString.length, encodedString, 'base64');
  }
  return (decodedString.toString());
}

// Used for getting all agents for multi-party dropdown
// Load available agents for multi-party
// Need common_private_ip and agent_service_port
function getAgentsFromProvider(callback) {
  const url = `https://${getConfigVal(COMMON_PRIVATE_IP)}:${parseInt(getConfigVal(AGENT_SERVICE_PORT), 10)}/getallagentrecs`;
  request({
    url,
    json: true
  }, (err, res, data) => {
    if (err) {
      data = {
        message: 'failed'
      };
    } else {
      console.log(JSON.stringify(data));
      callback(data);
    }
  });
}



// Allow cross-origin requests to be received from Management Portal
// Used for the force logout functionality since we need to send a POST
// request from MP to acedirect outlining what user(s) to forcefully logout
app.use((err, req, res, next) => {
  const mp = `https://${getConfigVal('servers:main_private_ip')}:${getConfigVal('app_ports:managementportal')}`;
  res.setHeader('Access-Control-Allow-Origin', mp);
  next();
});

app.use((err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') return next(err);
  // handle CSRF token errors here
  res.status(200).json({
    message: 'Form has been tampered'
  });
});

/**
 * Handles the forceful logout request from Management Portal
 */
app.post('/forcelogout', (req, _res) => {
  const { body } = req;
  const { agents } = body;
  const forceLogoutPassword = req.headers.force_logout_password;
  // Check that the received force logout password matches the one we have in the config
  // This verifies that the request is being made internally and is a valid request
  if (forceLogoutPassword === getConfigVal('management_portal:force_logout_password')) {
    // Loop through all of the agents and log them out one by one
    agents.forEach((agent) => {
      // Emit the forceful logout event to each agent by extension
      io.to(Number(agent.extension)).emit('force-logout');
    });
  }
});


app.use((req, res, next) => {
  req.dbConnection = dbConnection;
  req.redisClient = redisClient;
  res.locals = {
    nginxPath,
    consumerPath,
    busyLightEnabled,
    awayBlink,
    outVidTimeout,
    stunFQDN,
    stunPort,
    turnFQDN,
    turnPort,
    turnUser,
    turnCred,
    logWebRTCStats,
    logWebRTCStatsFreq,
    logWebRTCMongo,
    fpsHigh,
    fpsLow,
    fpsMax,
    fpsMin,
    fpsOptimum,
    isOpen,   // move these 3 to util?
    endTimeUTC,
    startTimeUTC,
    csrfToken: req.csrfToken(),
    version,
    fileSharingEnabled,
    screenSharingEnabled,
    goodbyeVideo,
    autoplayEnabled,
    year,
    sponsor,
    consumerPortalTitle,
    consumerPortalLogo,
    consumerPortalDisclaimer,
    consumerPortalEndMessage,
    // agentPortalLoginLogo,
    // agentPortalLoginEmail,
    // agentPortalLoginPhone,
    // agentPortalLoginDisclaimer
  };
  next();
});

const adRoutes = require('./app/routes');
app.use('/', adRoutes);

// Download depends on globals; define this route here
app.get('/downloadFile', /* agent.shield(cookieShield) , */(req, res) => {
    if (sharingAgent !== undefined && sharingConsumer !== undefined) {
        for (let i = 0; i < sharingAgent.length; i += 1) {
            // make sure the agent is in a call with the consumer who sent the file
            if (req.session.user.extension === sharingAgent[i] || req.session.user.vrs === sharingConsumer[i]) {
                console.log('In valid session');
                let tempFileToken = fileToken[i].toString();
                if (tempFileToken.includes((req.query.id).split('"')[0])) { // remove the filename from the ID if it's there
                    console.log('allowed to download');

                    const documentID = req.query.id;
                    let url = `https://${getConfigVal('servers:main_private_ip')}:${getConfigVal('app_ports:mserver')}`;
                    url += `/getStoreFileInfo?documentID=${documentID}`;
                    request({
                        url,
                        json: true
                    }, (error, response, data) => {
                        if (error) {
                            res.status(500).send('Error');
                        } else if (data.message === 'Success') {
                            const { filepath } = data;
                            const { filename } = data;
                            const readStream = fs.createReadStream(filepath);
                            res.attachment(filename);
                            readStream.pipe(res);
                        } else {
                            res.status(500).send('Error');
                        }
                    });
                    break;
                } else {
                    console.log('Not authorized to download this file, mismatched IDs');
                }
            } else {
                console.log('Not authorized to download');
            }
        }
    } else {
        console.log('Not authorized to download');
    }
});


app.get('/viewFile', /* agent.shield(cookieShield) , */(req, res) => {
  if (sharingAgent !== undefined && sharingConsumer !== undefined) {
      for (let i = 0; i < sharingAgent.length; i += 1) {
          // make sure the agent is in a call with the consumer who sent the file
          if (req.session.user.extension === sharingAgent[i] || req.session.user.vrs === sharingConsumer[i]) {
              console.log('In valid session');
              let tempFileToken = fileToken[i].toString();
              if (tempFileToken.includes((req.query.id).split('"')[0])) { // remove the filename from the ID if it's there
                  console.log('allowed to view');

                  const documentID = req.query.id;
                  let url = `https://${getConfigVal('servers:main_private_ip')}:${getConfigVal('app_ports:mserver')}`;
                  url += `/getStoreFileInfo?documentID=${documentID}`;
                  request({
                      url,
                      json: true
                  }, (error, response, data) => {
                      if (error) {
                          res.status(500).send('Error');
                      } else if (data.message === 'Success') {
                          const { filepath } = data;
                          const { filename } = data;
                          const readStream = fs.createReadStream(filepath);
                          res.attachment(filename);
                          res.setHeader('Content-disposition', 'inline');
                          readStream.pipe(res);
                      } else {
                          res.status(500).send('Error');
                      }
                  });
                  break;
              } else {
                  console.log('Not authorized to view this file, mismatched IDs');
              }
          } else {
              console.log('Not authorized to view');
          }
      }
  } else {
      console.log('Not authorized to view');
  }
});
// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use((err, req, res, next) => {
  if (err.status === 404) {
    res.status(err.status);
    res.render('pages/404');
  } else {
    // render the error page
    res.status(err.status || 500);
    res.render('pages/error');
  }
});

// do it here, after socket is established
sendEmit('lightcode-configs', utils.loadColorConfigs());
