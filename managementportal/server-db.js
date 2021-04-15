// node modules
let dbconn = null;
let dbConnection = null;
const AsteriskManager = require('asterisk-manager');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser'); // the session is stored in a cookie, so we use this to parse it
const express = require('express');
const fs = require('fs');
const https = require('https');
const { MongoClient } = require('mongodb');
const nconf = require('nconf');
const openamAgent = require('@forgerock/openam-agent');
const request = require('request');
const session = require('express-session');
const socketioJwt = require('socketio-jwt');
const tcpp = require('tcp-ping');
const url = require('url');
const mysql = require('mysql');
const Json2csvParser = require('json2csv').Parser;
const redis = require('redis');
const socketIO = require('socket.io');

// additional helpers/utility functions
const { getConfigVal } = require('./helpers/utility');
const logger = require('./helpers/logger');
const metrics = require('./controllers/metrics');
const report = require('./controllers/report');
const { setRgbValues } = require('./helpers/utility');
const validator = require('./utils/validator');

let port = null; // set the port
let ami = null; // Asterisk AMI
const Queues = []; // Associative array
const Agents = []; // Associative array
let AgentStats = []; // last stored stats on agents
let QueueStats = []; // last stored stats on queues

const AgentMap = new Map(); // associate extension to agent database record;
let AsteriskQueuenames = [];

// colEvents and colStats for MongoDb
let colEvents = null;
let colStats = null;

/**
 * Iniate action to Asterisk
 * @param {type} obj
 * @returns {undefined}
 */
function amiaction(obj) {
  ami.action(obj, (err) => {
    if (err) {
      logger.error('AMI amiaction error ');
    }
  });
}

/**
 * Reset Asterisk stat counters
 * @returns {undefined} Not used
 */
function resetAllCounters() {
  for (let i = 0; i < AsteriskQueuenames.length; i += 1) {
    logger.info(`QueueReset: ${AsteriskQueuenames[i]}`);
    amiaction({
      action: 'QueueReset',
      Queue: AsteriskQueuenames[i]
    });
    logger.log(AsteriskQueuenames[i]);
  }
}

/**
 * Backup the Agents and Queues stats into mongoDB - this should be invoked periodically
 * @returns {undefined} Not used
 */
function backupStatsinDB() {
  const ts = new Date();

  /* backup Agents and Queues stats field: using the same JSON elements as in original object
       *
       * Timestamp:
     * agentstats[]:
     * agent: "30001", // by asterisk extension
     * talktime: 0,
     * avgtalktime: 0,
     * callstaken: 0
     * queuestats[]:
     * queue: "GeneralQuestionsQueue",
     * holdtime: "0.00"
     * talktime: "0.00"
     * longestholdtime: "0.00"
     * completed: 0
     * abandoned: 0
     * calls: 0
     */

  const data = {};
  data.Timestamp = ts.toISOString();

  // adding Agents[] stats
  data.agentstats = [];
  Agents.forEach((element) => {
    const astats = {};
    astats.agent = element.agent;
    astats.talktime = element.talktime;
    astats.holdtime = element.holdtime;
    astats.avgtalktime = element.avgtalktime;
    astats.callstaken = element.callstaken;
    data.agentstats.push(astats);
  });

  // adding Queues stats
  data.queuestats = [];
  Queues.forEach((element) => {
    const qstats = {};
    qstats.queue = element.queue;
    qstats.cumulativeHoldTime = element.cumulativeHoldTime;
    qstats.cumulativeTalkTime = element.cumulativeTalkTime;
    qstats.longestholdtime = element.longestholdtime;
    qstats.completed = element.completed;
    qstats.abandoned = element.abandoned;
    qstats.totalCalls = element.totalCalls;
    data.queuestats.push(qstats);
  });

  if (colStats != null) {
    colStats.insertOne(data, (err, _result) => {
      if (err) {
        console.log(`backupStatsinDB(): insert callstats into MongoDB, error: ${err}`);
        logger.debug(`backupStatsinDB(): insert callstats into MongoDB, error: ${err}`);
        throw err;
      }
    });
  }
}

/**
 * Load persisted  Agents and Queues stats from mongoDB
 * - this should be invoked when managementportal restarts
 *
 * Curent design assumes that this is invoked after Agents[] and Queues[]
 * are fully populated - may need to verify whether this is always true
 *
 * @returns {undefined} Not used
 */
function loadStatsinDB() {
  // Find the last stats entry backed up in mongoDB
  if (colStats != null) {
    const cursor = colStats.find().limit(1).sort({ $natural: -1 });

    cursor.toArray((err, data) => {
      if (err) console.log(`Stats find returned error: ${err}`);

      if (data[0] != null) {
        // for now only saving this, cannot copy them into Agents[] and Queues[]
        // since they may be empty
        AgentStats = data[0].agentstats;
        QueueStats = data[0].queuestats;
      }
    });
  }

  console.log('---------------------------- Stats pulled out of mongoDB: ');
}

function myCleanup() {
  // clean up code on exit, exception, SIGINT, etc.
  console.log('');
  console.log('***Exiting***');

  // backup MongoDB stats
  if (dbconn) {
    console.log('Backing up MongoDB stats...');
    backupStatsinDB(); // need to synchronize?
  }

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

// CLEAN UP function; must be at the top!
// for exits, abnormal ends, signals, uncaught exceptions
require('./cleanup').Cleanup(myCleanup);

// declare constants for various config values
const COMMON_PRIVATE_IP = 'common:private_ip';
const NGINX_FQDN = 'nginx:fqdn';
const COLOR_CONFIG_JSON_PATH = '../dat/color_config.json';
const ASTERISK_SIP_PRIVATE_IP = 'asterisk:sip:private_ip';
const AGENT_SERVICE_PORT = 'agent_service:port';
const ACE_DIRECT_PORT = 'ace_direct:https_listen_port';

const app = express(); // create our app w/ express

// Required for REST calls to self signed certificate servers
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const cfile = '../dat/config.json'; // Config file
nconf.argv().env();
nconf.file({
  file: cfile
});
console.log(`Config file: ${cfile}`);
logger.info(`Config file: ${cfile}`);

const credentials = {
  key: fs.readFileSync(getConfigVal('common:https:private_key')),
  cert: fs.readFileSync(getConfigVal('common:https:certificate'))
};

// Redis Setup

// Redis keys/mappings
// Contains login name => JSON data passed from browser
// const redisStatusMap = 'statusMap';
// Map of Agent information, key agent_id value JSON object
// const redisAgentInfoMap = 'agentInfoMap';

// Create a connection to Redis
const redisClient = redis.createClient(getConfigVal('database_servers:redis:port'), getConfigVal('database_servers:redis:host'));

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
});

// catch Redis warnings
redisClient.on('warning', (wrn) => {
  logger.warn(`REDIS warning: ${wrn}`);
});

redisClient.auth(getConfigVal('database_servers:redis:auth'));

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
  console.log('Connected to Redis');
});

// get the ACE Direct version
const version = getConfigVal('common:version');
const year = getConfigVal('common:year');
logger.info(`This is ACE Direct v${version}, Copyright ${year}.`);

// NGINX path parameter
let nginxPath = getConfigVal('nginx:mp_path');
if (nginxPath.length === 0) {
  // default for backwards compatibility
  nginxPath = '/ManagementPortal';
}

const policyAgent = new openamAgent.PolicyAgent({
  serverUrl: `https://${getConfigVal(NGINX_FQDN)}:${getConfigVal('nginx:port')}/${getConfigVal('openam:path')}`,
  privateIP: getConfigVal('nginx:private_ip'),
  errorPage() {
    return '<html><body><h1>Access Error</h1></body></html>';
  }
});
const cookieShield = new openamAgent.CookieShield({
  getProfiles: false,
  cdsso: false,
  noRedirect: false,
  passThrough: false
});

app.use(cookieParser()); // must use cookieParser before expressSession
app.use(session({
  secret: getConfigVal('web_security:session:secret_key'),
  resave: getConfigVal('web_security:session:resave'),
  rolling: getConfigVal('web_security:session:rolling'),
  saveUninitialized: getConfigVal('web_security:session:save_uninitialized'),
  cookie: {
    maxAge: parseFloat(getConfigVal('web_security:session:max_age')),
    httpOnly: getConfigVal('web_security:session:http_only'),
    secure: getConfigVal('web_security:session:secure')
  }
}));
// set the view engine to ejs
app.set('view engine', 'ejs');
app.use(express.static(`${__dirname}/public`));
app.use(bodyParser.urlencoded({
  extended: 'true'
})); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.use(bodyParser.json({
  type: 'application/vnd.api+json'
})); // parse application/vnd.api+json as json

nconf.defaults({ // if the port is not defined in the cocnfig.json file, default it to 8080
  dashboard: {
    pollInterval: 10000
  },
  https: {
    'port-dashboard': 8090
  }
});

let fqdn = '';
if (nconf.get(NGINX_FQDN)) {
  fqdn = getConfigVal(NGINX_FQDN);
} else {
  logger.error(`*** ERROR: ${NGINX_FQDN} is required in dat/config.json.`);
  console.error(`*** ERROR: ${NGINX_FQDN} is required in dat/config.json.`);
  process.exit(-99);
}
const fqdnTrimmed = fqdn.trim(); // Remove the newline
const fqdnUrl = `https://${fqdnTrimmed}:*`;

port = parseInt(getConfigVal('management_portal:https_listen_port'), 10);

const httpsServer = https.createServer(credentials, app);

const io = socketIO(httpsServer, {
  cookie: false,
  origins: fqdnUrl
});

// Pull MySQL configuration from config.json file
const dbHost = getConfigVal('database_servers:mysql:host');
const dbUser = getConfigVal('database_servers:mysql:user');
const dbPassword = getConfigVal('database_servers:mysql:password');
const dbName = getConfigVal('database_servers:mysql:ad_database_name');
const dbPort = parseInt(getConfigVal('database_servers:mysql:port'), 10);
const vmTable = 'videomail';
const callBlockTable = 'call_block';
const callBlockVrsPrefix = '1';

// Create MySQL connection and connect to the database
dbConnection = mysql.createConnection({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  port: dbPort
});

dbConnection.connect();

// Keeps connection from Inactivity Timeout
setInterval(() => {
  dbConnection.ping();
}, 60000);

// Pull MongoDB configuration from config.json file
const mongodbUriEncoded = nconf.get('database_servers:mongodb:connection_uri');
const logAMIEvents = nconf.get('database_servers:mongodb:logAMIevents');
const logStats = nconf.get('database_servers:mongodb:logStats');
const logStatsFreq = nconf.get('database_servers:mongodb:logStatsFreq');
let mongodb;

// Connect to MongoDB
if (typeof mongodbUriEncoded !== 'undefined' && mongodbUriEncoded) {
  const mongodbUri = getConfigVal('database_servers:mongodb:connection_uri');
  // Initialize connection once
  MongoClient.connect(mongodbUri, {
    forceServerObjectId: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (errConnect, database) => {
    if (errConnect) {
      logger.error('*** ERROR: Could not connect to MongoDB. Please make sure it is running.');
      console.error('*** ERROR: Could not connect to MongoDB. Please make sure it is running.');
      process.exit(-99);
    }

    console.log('MongoDB Connection Successful');
    dbconn = database;
    mongodb = database.db();

    // Start the application after the database connection is ready
    httpsServer.listen(port);
    console.log(`https web server listening on ${port}`);

    // prepare an entry into MongoDB to log the managementportal restart
    const ts = new Date();
    const data = {
      Timestamp: ts.toISOString(),
      Role: 'managementportal',
      Purpose: 'Restarted'
    };

    if (logAMIEvents) {
      // first check if collection "events" already exist, if not create one
      mongodb.listCollections({ name: 'events' }).toArray((errList, collections) => {
        console.log(`try to find events collection, colEvents length: ${collections.length}`);
        if (collections.length === 0) { // "stats" collection does not exist
          console.log('Creating new events colleciton in MongoDB');
          mongodb.createCollection('events', { capped: true, size: 1000000, max: 5000 }, (err, _result) => {
            if (err) throw err;
            console.log('Collection events is created capped size 100000, max 5000 entries');
            colEvents = mongodb.collection('events');
          });
        } else {
          // events collection exist already
          console.log('Collection events exist');
          colEvents = mongodb.collection('events');
          // insert an entry to record the start of managementportal
          colEvents.insertOne(data, (err, _result) => {
            if (err) {
              console.log(`Insert a record into events collection of MongoDB, error: ${err}`);
              logger.debug(`Insert a record into events collection of MongoDB, error: ${err}`);
              throw err;
            }
          });
        }
      });
    }

    if (logStats) {
      // first check if collection "stats" already exist, if not create one
      mongodb.listCollections({ name: 'callstats' }).toArray((errList, collections) => {
        console.log(`try to find stats collection, colStats length: ${collections.length}`);
        if (collections.length === 0) { // "stats" collection does not exist
          console.log('Creating new stats colleciton in MongoDB');
          mongodb.createCollection('callstats', { capped: true, size: 1000000, max: 5000 }, (err, _result) => {
            if (err) {
              console.log(`Error creating collection for callstats in Mongo: ${err}`);
              logger.debug(`Error creating collection for callstats in Mongo: ${err}`);
              throw err;
            }
            logger.info('Collection stats is created capped size 100000, max 5000 entries');
            colStats = mongodb.collection('callstats');
          });
        } else {
          // stats collection exists already
          console.log('Collection stats exist, loading the last stats into managementportal, TBD');
          colStats = mongodb.collection('callstats');
          loadStatsinDB();
        }
      });
    }
  });
} else {
  console.log('Missing MongoDB Connection URI in config');

  httpsServer.listen(port);
  console.log(`https web server listening on ${port}`);
}

// Validates the token, if valid go to connection.
// If token is not valid, no connection will be established.
const jwtKey = getConfigVal('web_security:json_web_token:secret_key');
// const jwtEnc = getConfigVal('web_security:json_web_token:encoding');

io.use(socketioJwt.authorize({
  // secret: ((jwtEnc == 'base64') ? Buffer.from(jwtKey , jwtEnc ): jwtKey),
  // If utf-8 validation is needed at a later time, package utf-8-validate can be used to check.
  secret: jwtKey, // jwtKey is a utf-8 string
  timeout: parseInt(getConfigVal('web_security:json_web_token:timeout'), 10), // seconds to send the authentication message
  handshake: getConfigVal('web_security:json_web_token:handshake')
}));

if (!fs.existsSync(COLOR_CONFIG_JSON_PATH) || !fs.existsSync('../dat/default_color_config.json')) {
  logger.error('color_config.json or default_color_config.json files do not exist in ../dat folder');
  console.log('color_config.json or default_color_config.json files do not exist in ../dat folder');
}

logger.info(`Listen on port: ${port}`);
const queuenames = getConfigVal('management_portal:queues');
const pollInterval = parseInt(getConfigVal('management_portal:poll_interval'), 10);
// const adUrl = `https://${getConfigVal(COMMON_PRIVATE_IP)}`;
console.log(`port number: ${port}, poll interval:${pollInterval}`);

AsteriskQueuenames = queuenames.split(',');

logger.info('****** Restarting server-db  ****');
logger.info(`Asterisk queuename: ${AsteriskQueuenames}, Poll Interval: ${pollInterval}`);

/**
 * Check resource status
 * @param {type} hosts
 * @param {type} callback
 * @returns {undefined}
 */
function checkConnection(hosts, callback) {
  const results = [];
  const requests = hosts.size;

  hosts.forEach((host, name) => {
    const parsedurl = url.parse(host, true, true);
    const { hostname } = parsedurl;
    let parsedUrlPort = parsedurl.port;
    if (parsedUrlPort === null) { parsedUrlPort = '80'; }
    // tests if each address is online
    tcpp.probe(hostname, parsedUrlPort, (err, isAlive) => {
      if (err) {
        callback({
          error: 'An Error Occurred'
        });
      } else {
        // push results to result arrary
        results.push({
          name,
          host,
          status: isAlive
        });
        if (results.length === requests) {
          // Sort Request by name
          results.sort((a, b) => {
            const nameA = a.name.toUpperCase(); // ignore upper and lowercase
            const nameB = b.name.toUpperCase(); // ignore upper and lowercase
            if (nameA < nameB) {
              return -1;
            }
            if (nameA > nameB) {
              return 1;
            }
            return 0;
          });
          // Callback with results of resource status probes
          callback({
            resources: results,
            timestamp: new Date().getTime()
          });
        }
      }
    });
  });
}

/**
 * Send Resoure status to Management Dashboard
 * @returns {undefined}
 */
function sendResourceStatus() {
  const hostMap = new Map();
  // list of resources to check for status
  hostMap.set('ACR-CDR', `https://${getConfigVal(COMMON_PRIVATE_IP)}:${getConfigVal('acr_cdr:https_listen_port')}`);
  hostMap.set('VRS Lookup', `https://${getConfigVal(COMMON_PRIVATE_IP)}:${getConfigVal('user_service:port')}`);
  hostMap.set('ACE Direct', `https://${getConfigVal(COMMON_PRIVATE_IP)}:${getConfigVal('ace_direct:https_listen_port')}`);

  hostMap.set('Zendesk', `${getConfigVal('zendesk:protocol')}://${getConfigVal('zendesk:private_ip')}:${getConfigVal('zendesk:port')}/api/v2`);
  hostMap.set('Agent Provider', `https://${getConfigVal(COMMON_PRIVATE_IP)}:${parseInt(getConfigVal(AGENT_SERVICE_PORT), 10)}`);

  checkConnection(hostMap, (data) => {
    io.to('my room').emit('resource-status', data);
  });

  const metricsStartDate = 1497916801000;
  const metricsEndDate = 1498003200000;
  metrics.createMetrics(mongodb, metricsStartDate, metricsEndDate, (data) => {
    io.to('my room').emit('metrics', data);
  });
}

io.sockets.on('connection', (socket) => {
  let numClients = 0;
  logger.info(`io.socket connected, id: ${socket.id}`);

  // emit AD version, year to clients
  socket.emit('adversion', {
    version,
    year
  });

  // socket.on('config', (message) => {
  //   logger.debug(`Got config message request: ${message}`);
  //   const confobj = {
  //     host: getConfigVal(ASTERISK_SIP_PRIVATE_IP),
  //     realm: getConfigVal(ASTERISK_SIP_PRIVATE_IP),
  //     stun: `${getConfigVal('asterisk:sip:stun')}:${getConfigVal('asterisk:sip:stun_port')}`,
  //     wsport: parseInt(getConfigVal('asterisk:sip:ws_port'), 10),
  //     channel: getConfigVal('asterisk:sip:channel'),
  //     websocket: `wss://${getConfigVal(ASTERISK_SIP_PRIVATE_IP)}:${getConfigVal('asterisk:sip:ws_port')}/ws`
  //   };

  //   socket.emit('sipconf', confobj);

  //   if (message === 'webuser') {
  //     const qobj = {
  //       queues: getConfigVal('management_portal:queues')
  //     };
  //     socket.emit('queueconf', qobj);
  //     logger.debug('Message is webuser type');
  //   }
  // });

  // Handle incoming Socket.IO registration requests - add to the room
  socket.on('register-manager', () => {
    logger.info("Adding client socket to room: 'my room'");
    // Add this socket to my room
    socket.join('my room');
    sendResourceStatus();
  });

  // Manually get resource status
  socket.on('resource-status-update', () => {
    sendResourceStatus();
  });

  socket.on('ami-req', (message) => {
    logger.debug(`Received AMI request: ${message}`);

    if (message === 'agent') {
      socket.emit('agent-resp', {
        agents: Agents
      });
      logger.debug('Sending agent resp');
    } else if (message === 'queue') {
      socket.emit('queue-resp', {
        queues: Queues
      });
      logger.debug('Sending queue resp');
    }
  });

  socket.on('agent-help', (data) => {
    logger.debug(`Received agent help data${data}`);
    io.sockets.emit('agent-request', data);
  });

  socket.on('message', (message) => {
    logger.debug(`Received message ${message}`);
    socket.broadcast.emit('message', message); // should be room only
  });

  // Assume socket.io is at version 1.3.5, where the API for getting clients is completely
  // different from pre 1.0 version

  socket.on('create or join', (room) => {
    if (room !== '' && room !== undefined) {
      socket.join(room);
    }

    const roomObject = io.nsps['/'].adapter.rooms[room];
    if (roomObject !== null) {
      numClients = Object.keys(roomObject).length;
    }

    logger.info(`Room ${room} has ${numClients} client(s) for client id:${socket.id}`);
    logger.debug(`Request to create or join room${room}`);

    if (numClients === 1) {
      socket.emit('created', room);
    } else if (numClients === 2) {
      try {
        io.sockets.to(room).emit('join', room);
        socket.emit('joined', room);
      } catch (err) {
        logger.error('Socket error in create or join ');
      }
    } else { // max two clients
      socket.emit('full', room);
    }
    socket.emit(`emit(): client ${socket.id} joined room ${room}`);
    socket.broadcast.emit(`broadcast(): client ${socket.id} joined room ${room.toString()}`);
  });

  socket.on('hangup', (room) => {
    socket.leave(room);
    logger.debug(`Request to leave room ${room.toString()}, room has ${numClients} client(s)`);
  });

  // Socket for Operating Status
  socket.on('hours-of-operation', (_data) => {
    const urlOperatingHours = `https://${getConfigVal(COMMON_PRIVATE_IP)}:${getConfigVal(AGENT_SERVICE_PORT)}/OperatingHours`;
    request({
      url: urlOperatingHours,
      json: true
    }, (err, res, hourData) => {
      const changedHourData = hourData;
      if (err) {
        logger.error(`Aserver error: ${err}`);
      } else {
        switch (hourData.business_mode) {
          case 0:
            changedHourData.business_mode = 'NORMAL';
            break;
          case 1:
            changedHourData.business_mode = 'FORCE_OPEN';
            break;
          case 2:
            changedHourData.business_mode = 'FORCE_CLOSE';
            break;
          default:
            changedHourData.business_mode = 'NORMAL';
            break;
        }

        io.to(socket.id).emit('hours-of-operation-response', changedHourData);
      }
    });
  }).on('hours-of-operation-update', (data) => {
    if (data.start && data.end) {
      const requestJson = {
        start: data.start,
        end: data.end
      };

      switch (data.business_mode) {
        case 'NORMAL':
          requestJson.business_mode = 0;
          break;
        case 'FORCE_OPEN':
          requestJson.business_mode = 1;
          break;
        case 'FORCE_CLOSE':
          requestJson.business_mode = 2;
          break;
        default:
          requestJson.business_mode = 0;
          break;
      }

      request({
        method: 'POST',
        url: `https://${getConfigVal(COMMON_PRIVATE_IP)}:${getConfigVal(AGENT_SERVICE_PORT)}/OperatingHours`,
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestJson,
        json: true
      }, (error, response, dataOperatingHours) => {
        if (error) {
          logger.error(`Aserver error: ${error}`);
        } else {
          io.to(socket.id).emit('hours-of-operation-update-response', dataOperatingHours);
        }
      });
    }
  });

  // Socket for CDR table
  socket.on('cdrtable-get-data', (data) => {
    let urlGetAllCdrRecs = `https://${getConfigVal(COMMON_PRIVATE_IP)}:${getConfigVal('acr_cdr:https_listen_port')}/getallcdrrecs`;
    const { format } = data;
    if (data.start && data.end) {
      urlGetAllCdrRecs += `?start=${data.start}&end=${data.end}`;
    }
    // ACR-CDR getallcdrrecs RESTful call to get CDR JSON string.
    console.log('CDRTABLE GET DATA');
    request({
      url: urlGetAllCdrRecs,
      json: true
    }, (err, res, cdrdata) => {
      if (err) {
        io.to(socket.id).emit('cdrtable-error', {
          message: 'Error Accessing Data Records'
        });
      } else if (format === 'csv') {
        // csv field values
        const csvFields = ['calldate', 'clid', 'src',
          'dst', 'dcontext', 'channel',
          'dstchannel', 'lastapp', 'lastdata',
          'duration', 'billsec', 'disposition',
          'amaflags', 'accountcode', 'userfield',
          'uniqueid', 'linkedid', 'sequence',
          'peeraccount'
        ];
        // Converts JSON object to a CSV file.
        const json2csvParser = new Json2csvParser({ csvFields });
        const csv = json2csvParser.parse(cdrdata.data);
        // returns CSV of Call Data Records
        io.to(socket.id).emit('cdrtable-csv', csv);
      } else {
        // returns JSON object of CDR
        io.to(socket.id).emit('cdrtable-data', cdrdata);
      }
    });
  });

  // Socket for Report table
  socket.on('reporttable-get-data', (data) => {
    const { format } = data;

    // console.log("reportStartDate: " + data.start);
    // console.log("reportEndDate: " + data.end);
    // console.log("reportFormat: " + format);

    const reportStartDate = new Date(data.start);
    const reportEndDate = new Date(data.end);
    const { timezone } = data;
    report.createReport(mongodb, reportStartDate.getTime(),
      reportEndDate.getTime(), timezone, (reportdata) => {
        if (format === 'csv') {
          // csv field values
          const csvFields = ['date', 'callshandled', 'callsabandoned',
            'videomails', 'webcalls'];
          // Converts JSON object to a CSV file.
          const json2csvParser = new Json2csvParser({ csvFields });
          const csv = json2csvParser.parse(reportdata.data);
          // returns Report Data
          io.to(socket.id).emit('reporttable-csv', csv);
        } else {
        // returns JSON object of Report
          io.to(socket.id).emit('reporttable-data', reportdata);
        }
      });
  });

  // Socket for Report table
  socket.on('vrsreporttable-get-data', (data) => {
    const { format } = data;

    const reportStartDate = new Date(data.start);
    const reportEndDate = new Date(data.end);
    const { timezone } = data;
    report.createVrsReport(mongodb, reportStartDate.getTime(),
      reportEndDate.getTime(), timezone, (reportdata) => {
        if (format === 'csv') {
          // csv field values

          const csvFields = ['vrs', 'date', 'status',
            'stateCode'];
          // Converts JSON object to a CSV file.
          const json2csvParser = new Json2csvParser({ csvFields });
          const csv = json2csvParser.parse(reportdata.data);
          // returns Report Data
          io.to(socket.id).emit('vrsreporttable-csv', csv);
        } else {
          // returns JSON object of Report
          io.to(socket.id).emit('vrsreporttable-data', reportdata);
        }
      });
  });

  socket.on('metrics-get-data', (data) => {
    if (data.start && data.end) {
      // Set start and end internally
      // Eventually store them in redis.
      const metricsStartDate = new Date(data.start);
      const metricsEndDate = new Date(data.end);
      metrics.createMetrics(mongodb, metricsStartDate.getTime(),
        metricsEndDate.getTime(), (metricsToEmit) => {
          io.to('my room').emit('metrics', metricsToEmit);
        });
    }
  });

  // ######################################
  // Retrieval of videomail records from the database
  socket.on('get-videomail', (data) => {
    logger.debug('entered get-videomail');

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
      if (sort[1] === 'desc') { vmSqlOrder += ' DESC'; }
    }

    const vmSqlQuery = `${vmSqlSelect} ${vmSqlWhere} ${vmSqlOrder};`;
    dbConnection.query(vmSqlQuery, vmSqlParams, (err, result) => {
      if (err) {
        logger.error(`GET-VIDEOMAIL ERROR: ${err.code}`);
      } else {
        io.to(socket.id).emit('got-videomail-recs', result);
      }
    });
    // Get videomail status summary for pie chart
    const vmSqlCountQuery = `SELECT status AS 'label', COUNT(*) AS 'data' FROM ${vmTable} WHERE deleted = 0 GROUP BY status;`;
    dbConnection.query(vmSqlCountQuery, (err, result) => {
      if (err) {
        logger.error(`GET-VIDEOMAIL ERROR: ${err.code}`);
      } else {
        logger.debug(result);
        io.to(socket.id).emit('videomail-status', result);
      }
    });
    // Additional status chart idea.
    // Bar chart x-axis hour of day 0-23, y-axis number of videomails in each hour
    // select extract(hour from received) as theHour, count(*) as numberOfItems
    // from videomail group by extract(hour from received);
    const vmSqlDeleteOld = `DELETE FROM ${vmTable} WHERE TIMESTAMPDIFF(DAY, deleted_time, CURRENT_TIMESTAMP) >= 14;`;
    dbConnection.query(vmSqlDeleteOld, (err, _result) => {
      if (err) {
        logger.error(`DELETE-OLD-VIDEOMAIL ERROR: ${err.code}`);
      } else {
        logger.debug('Deleted old videomail');
      }
    });
  });

  // updates videomail records when the agent changes the status
  socket.on('videomail-status-change', (data) => {
    logger.debug('updating MySQL entry');
    const vmSqlQuery = `UPDATE ${vmTable} SET status = ?, processed = CURRENT_TIMESTAMP,
      processing_agent = 'manager', deleted = 0, deleted_time = NULL, deleted_by = NULL  WHERE id = ?;`;
    const vmSqlParams = [data.status, data.id];
    logger.debug(`${vmSqlQuery} ${vmSqlParams}`);
    dbConnection.query(vmSqlQuery, vmSqlParams, (err, result) => {
      if (err) {
        logger.error(`VIDEOMAIL-STATUS-CHANGE ERROR: ${err.code}`);
      } else {
        logger.debug(result);
        io.to(socket.id).emit('changed-status', result);
      }
    });
  });

  // changes the videomail status to READ if it was UNREAD before
  socket.on('videomail-read-onclick', (data) => {
    logger.debug('updating MySQL entry');
    const vmSqlQuery = `UPDATE ${vmTable} SET status = 'READ',
    processed = CURRENT_TIMESTAMP, processing_agent = 'manager' WHERE id = ?;`;
    const vmSqlParams = [data.id];
    logger.debug(`${vmSqlQuery} ${vmSqlParams}`);
    dbConnection.query(vmSqlQuery, vmSqlParams, (err, result) => {
      if (err) {
        logger.error(`VIDEOMAIL-READ ERROR: ${err.code}`);
      } else {
        logger.debug(result);
        io.to('my room').emit('changed-status', result);
      }
    });
  });

  // updates videomail records when the agent deletes the videomail.
  // Keeps it in db but with a deleted flag
  socket.on('videomail-deleted', (data) => {
    logger.debug('updating MySQL entry');
    const vmSqlQuery = `DELETE FROM ${vmTable} WHERE id = ?;`;
    const vmSqlParams = [data.id];
    logger.debug(`${vmSqlQuery} ${vmSqlParams}`);
    dbConnection.query(vmSqlQuery, vmSqlParams, (err, result) => {
      if (err) {
        logger.error(`VIDEOMAIL-DELETE ERROR: ${err.code}`);
      } else {
        io.to('my room').emit('changed-status', result);
      }
    });
  });

  // Socket for Light Configuration
  // read color_config.json file for light configuration
  socket.on('get_color_config', () => {
    try {
      // send json file to client
      const filePath = COLOR_CONFIG_JSON_PATH;
      const data = fs.readFileSync(filePath, 'utf8');
      socket.emit('html_setup', data);
    } catch (ex) {
      logger.error(`Error: ${ex}`);
    }
  });

  // on light color config submit update current color_config.json file
  socket.on('submit', (formData) => {
    try {
      const filePath = COLOR_CONFIG_JSON_PATH;
      const data = fs.readFileSync(filePath, 'utf8');
      let jsonData = JSON.parse(data);

      Object.keys(jsonData.statuses).forEach((status) => {
        const colorAndAction = formData[status].split('_'); // colorAndAction[0] = color, colorAndAction[1] = "blinking" or "solid"
        jsonData.statuses[status].color = colorAndAction[0].toLowerCase();
        jsonData.statuses[status].stop = (colorAndAction[0] === 'off');
        jsonData.statuses[status].blink = (colorAndAction[1] === 'blinking');
        jsonData = setRgbValues(jsonData, status, colorAndAction[0]);
      });

      fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf-8', (errWriteFile) => {
        if (errWriteFile) {
          logger.error(`ERROR writing: ${filePath}`);
          throw errWriteFile;
        } else {
          // successful write
          // send request to AD  server
          const url2 = `https://${getConfigVal(COMMON_PRIVATE_IP)}:${parseInt(getConfigVal(ACE_DIRECT_PORT), 10)}/updatelightconfigs`;
          request({
            url: url2,
            json: true
          }, (err, _res, _data) => {
            if (err) {
              logger.error('ERROR sending request to adserver /updatelightconfigs');
            } else {
              logger.debug('SUCCESS sending request to adserver /updatelightconfigs');
            }
          });
        }
      });
    } catch (ex) {
      logger.error(`Error: ${ex}`);
    }
  });

  // sends the default_color_config.json data back to the management portal
  socket.on('reset-color-config', () => {
    try {
      const defaultColorConfig = '../dat/default_color_config.json';
      const data = fs.readFileSync(defaultColorConfig, 'utf8');
      socket.emit('update-colors', data);
    } catch (ex) {
      logger.error(`Error: ${ex}`);
      console.log(`Error: ${ex}`);
    }
  });

  // Forcefully logs out any agents that have been selected to be logged
  // out in the Management Portal administration section
  socket.on('forceLogout', (agents) => {
    // Check to see if the force logout password is present in the config
    const forceLogoutPassword = getConfigVal('management_portal:force_logout_password');
    if (!forceLogoutPassword) {
      // Emit the event to the front end since we cant find a config value
      // for the force logout password
      socket.emit('forceLogoutPasswordNotPresent');
    } else {
      // A password exists within the config file. Continue the force logout process
      // Create the data to send to ace direct
      const requestJson = { agents: [] };
      agents.forEach((agent) => {
        requestJson.agents.push(agent);
      });
      // Send a post request to ace direct force logout route
      const urlForceLogout = `https://${getConfigVal(COMMON_PRIVATE_IP)}:${getConfigVal(ACE_DIRECT_PORT)}/forcelogout`;
      request({
        method: 'POST',
        url: urlForceLogout,
        headers: {
          'Content-Type': 'application/json',
          // Pass in custom header containing the MP force logout password from the config file
          force_logout_password: forceLogoutPassword
        },
        body: requestJson,
        json: true
      }, (error, response, data) => {
        if (error) {
          logger.error(`adserver error: ${error}`);
        } else {
          console.log(`forcelogout response: ${JSON.stringify(response, null, 2, true)}`);
          console.log(`forcelogout response data: ${JSON.stringify(data, null, 2, true)}`);
        }
      });
    }
  });

  socket.on('get-callblocks', (_dataIn) => {
    logger.debug('entered get-callblocks');

    const queryStr = `SELECT vrs, admin_username, reason, timeUpdated, call_block_id, false as selected FROM ${callBlockTable}`;
    const vmSqlParams = [];

    dbConnection.query(queryStr, vmSqlParams, (err, result) => {
      const data = {};
      if (err) {
        logger.error(`GET-CALLBLOCKS ERROR: ${err.code}`);
        data.message = '';
      } else {
        data.message = 'Success';
        data.data = result;
        io.to(socket.id).emit('got-callblocks-recs', data);
      }
    });
  });

  socket.on('add-callblock', (dataIn) => {
    logger.debug('entered add-callblock');
    const token = socket.decoded_token;

    const data = {};
    if (validator.isVrsNumberValid(dataIn.data.vrs)) {
      const queryStr = `INSERT INTO ${callBlockTable} (vrs, admin_username, reason, timeUpdated) VALUES (?,?,?,?);`;
      const values = [dataIn.data.vrs, token.username, dataIn.data.reason, new Date()];

      dbConnection.query(queryStr, values, (errQuery, result) => {
        if (errQuery) {
          logger.error('Error with adding blocked number: ', errQuery.code);
          data.message = '';
          io.to(socket.id).emit('add-callblock-rec', data);
        } else {
          const obj = {
            Action: 'DBPut',
            ActionID: Date.now(),
            Family: 'blockcaller',
            Key: callBlockVrsPrefix + dataIn.data.vrs,
            Val: 1
          };

          ami.action(obj, (err, res) => {
            if (err) {
              logger.error('AMI amiaction error ');
              logger.error(JSON.stringify(err, null, 2));

              data.message = '';
              io.to(socket.id).emit('add-callblock-rec', data);
            } else {
              logger.debug(JSON.stringify(res, null, 2));

              data.message = 'Success';
              data.data = result;
              io.to(socket.id).emit('add-callblock-rec', data);
            }
          });
        }
      });
    } else {
      data.message = 'Invalid VRS number, cannot add.';
      data.data = 'Invalid VRS number, cannot add.';
      io.to(socket.id).emit('add-callblock-rec', data);
    }
  });

  socket.on('update-callblock', (dataIn) => {
    logger.debug('entered update-callblock');

    const queryStr = `UPDATE ${callBlockTable} SET reason = "${dataIn.data.reason}" WHERE call_block_id = ${dataIn.data.id}`;
    const vmSqlParams = [];

    dbConnection.query(queryStr, vmSqlParams, (err, result) => {
      const data = {};
      if (err) {
        logger.error(`UPDATE-CALLBLOCKS ERROR: ${err.code}`);
        data.message = '';
        io.to(socket.id).emit('update-callblock-rec', data);
      } else {
        data.message = 'Success';
        data.data = result;
        io.to(socket.id).emit('update-callblock-rec', data);
      }
    });
  });

  socket.on('delete-callblock', (dataIn) => {
    logger.debug('entered delete-callblock');

    const queryStr = `DELETE FROM ${callBlockTable} WHERE call_block_id IN (${dataIn.data.id})`;
    const vmSqlParams = [];
    dbConnection.query(queryStr, vmSqlParams, (errQuery, result) => {
      const data = {};
      if (errQuery) {
        logger.error(`DELETE-CALLBLOCKS ERROR: ${errQuery.code}`);
        data.message = '';
        io.to(socket.id).emit('delete-callblock-rec', {});
      } else if (dataIn.data.bulk) {
        const myarray = dataIn.data.vrs.split(',');

        for (let i = 0; i < myarray.length; i += 1) {
          console.log(myarray[i]);

          let obj = {
            Action: 'DBDel',
            ActionID: Date.now(),
            Family: 'blockcaller',
            Key: callBlockVrsPrefix + myarray[i]
          };
          console.log(JSON.stringify(obj, null, 2));

          ami.action(obj, (err, res) => {
            if (err) {
              logger.error('AMI amiaction error ');
              console.log(JSON.stringify(err, null, 2));

              data.message = '';
              io.to(socket.id).emit('delete-callblock-rec', {});
            } else {
              console.log(JSON.stringify(res, null, 2));

              data.message = 'Success';
              data.data = result;
              io.to(socket.id).emit('delete-callblock-rec', data);
            }
          });

          obj = {
            Action: 'DBGet',
            ActionID: Date.now(),
            Family: 'blockcaller',
            Key: callBlockVrsPrefix + myarray[i]
          };
          console.log(JSON.stringify(obj, null, 2));

          ami.action(obj, (err, res) => {
            if (err) {
              logger.error('AMI amiaction error ');
              console.log(JSON.stringify(err, null, 2));
            } else {
              console.log(JSON.stringify(res, null, 2));
            }
          });
        }
      } else {
        const obj = {
          Action: 'DBDel',
          ActionID: Date.now(),
          Family: 'blockcaller',
          Key: callBlockVrsPrefix + dataIn.data.vrs
        };

        ami.action(obj, (err, res) => {
          if (err) {
            logger.error('AMI amiaction error ');
            logger.error(JSON.stringify(err, null, 2));

            data.message = '';
            io.to(socket.id).emit('delete-callblock-rec', {});
          } else {
            logger.debug(JSON.stringify(res, null, 2));

            data.message = 'Success';
            data.data = result;
            io.to(socket.id).emit('delete-callblock-rec', data);
          }
        });

        // obj = {
        //  'Action':'DBGet',
        //  'ActionID' : Date.now(),
        //  'Family' : 'blockcaller',
        //  'Key' : callBlockVrsPrefix + dataIn.data.vrs,
        // };
        // console.log(JSON.stringify(obj, null, 2));

        // ami.action(obj, function (err, res) {
        //  if (err) {
        //    logger.error('AMI amiaction error ');
        //    console.log(JSON.stringify(err, null, 2));
        //  }
        //  else {
        //    console.log(JSON.stringify(res, null, 2));
        //  }
        // });
      }
    });
  });

  socket.on('sync-callblocks', (_dataIn) => {
    logger.debug('entered sync-callblocks');

    const queryStr = `SELECT vrs FROM ${callBlockTable}`;
    const vmSqlParams = [];

    dbConnection.query(queryStr, vmSqlParams, (errQuery, result) => {
      const data = {};
      if (errQuery) {
        logger.error(`SYNC-CALLBLOCKS ERROR: ${errQuery.code}`);

        data.message = '';
        io.to(socket.id).emit('sync-callblock-recs', data);
      } else {
        const mysqlVrsNumbers = result.map((a) => callBlockVrsPrefix + a.vrs);
        logger.debug(`mysql blocked VRS Numbers: ${JSON.stringify(mysqlVrsNumbers, null, 2)}`);

        // Get VRS numbers from asterisk db
        const obj = {
          Action: 'Command',
          Command: 'database show blockcaller'
        };

        ami.action(obj, (err, res) => {
          if (err) {
            logger.error('AMI amiaction error ');
            logger.error(JSON.stringify(err, null, 2));

            data.message = '';
            io.to(socket.id).emit('sync-callblock-recs', data);
          } else if (res.response === 'Success') {
            // {
            //  "response": "Success",
            //  "actionid": "1594741905590",
            //  "message": "Command output follows",
            //  "output": [
            //    "/blockcaller/13213077251                          : 1                        ",
            //    "/blockcaller/14444444444                          : 1                        ",
            //    "2 results found."
            //  ]
            // }

            const asteriskVRSNumbers = [];
            // Extract VRS numbers from Output lines containing "blockcaller"
            res.output.forEach((line) => {
              if (line.includes('blockcaller')) {
                const vrs = line.replace('/blockcaller/', '').slice(0, 11);
                asteriskVRSNumbers.push(vrs);
              }
            });
            logger.debug(`asterisk blocked VRS Numbers: ${JSON.stringify(asteriskVRSNumbers, null, 2)}`);

            const mysqlOnlyCallblock = mysqlVrsNumbers
              .filter((x) => asteriskVRSNumbers.indexOf(x) === -1);
            const asteriskOnlyCallblock = asteriskVRSNumbers
              .filter((x) => mysqlVrsNumbers.indexOf(x) === -1);
            logger.info(`mysqlOnlyCallblock: ${JSON.stringify(mysqlOnlyCallblock, null, 2)}`);
            logger.info(`asteriskOnlyCallblock: ${JSON.stringify(asteriskOnlyCallblock, null, 2)}`);

            // If mysql has VRS numbers not in asterisk, Add them to asterisk
            mysqlOnlyCallblock.forEach((element) => {
              const objDbPut = {
                Action: 'DBPut',
                ActionID: Date.now(),
                Family: 'blockcaller',
                Key: element,
                Val: 1
              };

              ami.action(objDbPut, (errDbPut, _res) => {
                if (errDbPut) {
                  logger.error('AMI amiaction error ');
                  logger.error(JSON.stringify(errDbPut, null, 2));

                  data.message = '';
                  io.to(socket.id).emit('sync-callblock-recs', data);
                } else {
                  logger.info(`Added ${element} to asterisk callblock`);
                }
              });
            });

            // If asterisk has VRS numbers not in mysql, Delete them from asterisk
            asteriskOnlyCallblock.forEach((element) => {
              const objDbDel = {
                Action: 'DBDel',
                ActionID: Date.now(),
                Family: 'blockcaller',
                Key: element
              };

              ami.action(objDbDel, (errDbDel, _res) => {
                if (errDbDel) {
                  logger.error('AMI amiaction error ');
                  logger.error(JSON.stringify(errDbDel, null, 2));

                  data.message = '';
                  io.to(socket.id).emit('sync-callblock-recs', data);
                } else {
                  logger.info(`Removed ${element} from asterisk callblock`);
                }
              });
            });

            data.message = 'Success';
            data.data = result;
            io.to(socket.id).emit('sync-callblocks-recs', data);
          } else {
            data.message = '';
            io.to(socket.id).emit('sync-callblock-recs', data);
          }
        });
      }
    });
  });
});

/**
 * Send message to the dashboard
 * @param {type} evt Asterisk Event type
 * @param {type} message Asterisk message
 * @returns {undefined} Not used
 */
function sendEmit(evt, message) {
  try {
    io.sockets.emit(evt, message);
  } catch (exp) {
    logger.error('Socket io emit error ');
  }
}

/**
 * Find the agent information
 * @param {type} agent
 * @returns {unresolved} Not used
 */
function findAgent(agent) { // find agent by name e.g. JSSIP/30001
  for (let i = 0; i < Agents.length; i += 1) {
    if (Agents[i].agent === agent) {
      return Agents[i];
    }
  }
  return null;
}

/**
 * Find the persisted agent information in MongoDB
 * @param {type} agent
 * @returns {unresolved} Not used
 */
function getAgentFromStats(agent) { // find agent by name e.g. JSSIP/30001
  for (let i = 0; i < AgentStats.length; i += 1) {
    if (AgentStats[i].agent === agent) {
      return AgentStats[i];
    }
  }
  return null;
}

/**
 * Set all agent status as Logoff.
 * @returns {undefined} Not used
 */
function setAgentsLogOff() {
  for (let i = 0; i < Agents.length; i += 1) {
    Agents[i].status = 'Logged Out';
    Agents[i].queue = '--';
  }
}

/**
 * Find Queue information for a specific queue
 * @param {type} queue
 * @returns {unresolved} Not used
 */
function findQueue(queue) {
  for (let i = 0; i < Queues.length; i += 1) {
    if (Queues[i].queue === queue) { return Queues[i]; }
  }
  return null;
}
/**
 * Find Queue information for a specific queue from queue stats loaded from Mongo
 * @param {type} queue
 * @returns {unresolved} Not used
 */
function findQueueFromStats(queue) {
  for (let i = 0; i < QueueStats.length; i += 1) {
    if (QueueStats[i].queue === queue) { return QueueStats[i]; }
  }
  return null;
}

/**
 * Caculate the total calls taken by an agent
 * @param {type} m Agent CallMap
 * @returns {undefined}
 */
function getTotalCallsTaken(m) {
  let num = 0;
  m.forEach((call) => {
    num += call;
  });
  // getTotalCallsTaken: num
  return num;
}

/**
 * increment the agent call for a specific queue after the agent completes a call
 * @param {type} m Agent CallMap
 * @param {type} myqueue Event Queue
 * @returns {undefined}
 */
function incrementCallMap(m, myqueue) {
  m.forEach((call, queue) => {
    if (queue === myqueue) {
      const increment = call + 1;
      m.set(queue, increment);
      logger.debug(`incrementCallMap: queue=${queue}, value=${increment}`);
    }
  });
}

/**
 * Process Asterisk's events
 * @param {type} evt Asterisk event
 * @returns {undefined} Not used
 */
function HandleManagerEvent(evt) {
  let a;
  let name;
  let q;

  const ts = new Date();
  const timestamp = { Timestamp: ts.toISOString() };
  const data = Object.assign(timestamp, evt);

  if (colEvents != null) {
    colEvents.insertOne(data, (err, _result) => {
      if (err) {
        logger.debug(`HandleManagerEvent(): insert event into MongoDB, error: ${err}`);
      }
    });
  }

  switch (evt.event) {
    case 'FullyBooted':
    {
      break;
    }
    case 'Agents': // response event in a series to the agents AMI action containing information about a defined agent.
    {
      a = findAgent(evt.agent); // find agent by extension e.g. JSSIP/60001
      const agentInt = parseInt(evt.agent, 10);
      if (!a) {
        if (AgentMap.has(agentInt)) {
          const evtNewAgent = evt;
          logger.debug('Agents: New Agent');
          evtNewAgent.name = AgentMap.get(agentInt).name;
          evtNewAgent.talktime = 0;
          evtNewAgent.holdtime = 0;
          evtNewAgent.callstaken = 0;
          evtNewAgent.avgtalktime = 0;
          evtNewAgent.queue = '--';
          evtNewAgent.status = 'Logged Out';

          evtNewAgent.callMap = new Map();
          for (let i = 0; i < AsteriskQueuenames.length; i += 1) {
            evtNewAgent.callMap.set(AsteriskQueuenames[i], 0); // set the total call to 0
          }

          Agents.push(evtNewAgent);
        } else {
          // AMI event Agent not in AgentMap

        }
      } else {
        const mongoAgent = getAgentFromStats(a.agent);
        if (mongoAgent) {
          if (mongoAgent.talktime > 0 && a.talktime === 0) {
            a.talktime = mongoAgent.talktime;
            a.totaltalktime = (a.talktime / 60).toFixed(2);
          }
          if (mongoAgent.holdtime > 0 && a.holdtime === 0) {
            a.holdtime = mongoAgent.holdtime;
          }
          if (mongoAgent.callstaken > 0 && a.callstaken === 0) {
            a.callstaken = mongoAgent.callstaken;
          }
          if (mongoAgent.avgtalktime > 0 && a.avgtalktime === 0) {
            a.avgtalktime = mongoAgent.avgtalktime;
          }
        }
        // Existing agent: status always set to AGENT_LOGGEDOFF. Do not use this field
      }
      break;
    }

    case 'AgentComplete': // raised when a queue member has member finished servicing a caller in the queue
    {
      // update calls, talktime and holdtime for agent; update
      // longestholdtime and currently active calls for queue
      name = evt.membername.split('/');
      a = findAgent(name[1]);

      if (a) {
        logger.debug(`${'AgentComplete: talktime = '}${evt.talktime}, holdtime= ${evt.holdtime}`);

        if (evt.talktime > 0) {
          a.talktime += Number(evt.talktime);
          a.totaltalktime = (a.talktime / 60).toFixed(2);
        }

        a.holdtime += Number(evt.holdtime);
        // increment the callsComplete - queueMember calls field didn't update.
        incrementCallMap(a.callMap, evt.queue);

        // find the queue associated with this agent complete event
        q = findQueue(evt.queue);
        // const tempQ = findQueueFromStats(evt.queue);
        // check if this hold time is longer than the corresponding queue's
        // current longest hold time
        const agentHoldTime = (Number(evt.holdtime) / 60).toFixed(2);
        if (q.longestholdtime < agentHoldTime) {
          // update the longest hold time
          q.longestholdtime = agentHoldTime;
        }
        // decrement the queue's calls in progress
        if (q.currentCalls > 0) {
          q.currentCalls -= 1;
        }
        q.cumulativeHoldTime += Number(evt.holdtime);
        q.cumulativeTalkTime += Number(evt.talktime);
        // do not send agent-resp till ends of QueueStatusComplete
      } else {
        logger.debug(`AgentComplete: cannot find agent ${evt.membername}`);
      }
      break;
    }
    case 'AgentConnect':
    {
      // increment the number of current calls for the queue with call in progress
      q = findQueue(evt.queue);
      q.currentCalls += 1;

      break;
    }
    case 'QueueMember':
    { // update status and averageTalkTime
      if (evt.name == null) {
        logger.error('HandleManagerEvent(evt) QueueMember ERROR - evt.name is null or undefined');
        break;
      }
      name = evt.name.split('/');
      a = findAgent(name[1]); // use full name e.g. PSSIP/30001 which is the extension
      if (a) {
        // QueueMember(): found existing Agent
        if (((evt.status === '5') || (evt.status === '1')) && evt.paused === '1') { // DEVICE_UNAVAILABLE
          a.status = 'Away';
        } else if (((evt.status === '1') || (evt.status === '5')) && evt.paused === '0') { // In a call
          a.status = 'Ready';
        } else if (evt.status === '2') { // In a call
          a.status = 'In Call';
        } else {
          a.queue = '--';
        }
        if (a.queue === '--') { a.queue = evt.queue; } else if (a.queue.indexOf(evt.queue) === -1) { a.queue += `, ${evt.queue}`; }

        // QueueMember event doesn't update "calls" - get it from AgentComplete
        const mongoAgent = getAgentFromStats(a.agent);
        a.callstaken = (mongoAgent && mongoAgent.callstaken > 0)
          ? (getTotalCallsTaken(a.callMap) + mongoAgent.callstaken) : getTotalCallsTaken(a.callMap);

        if (a.callstaken > 0) {
          a.avgtalktime = ((a.talktime / a.callstaken) / 60).toFixed(2);
        }
      }
      // wait until we processed all members
      break;
    }
    case 'QueueParams':
    {
      q = findQueue(evt.queue);
      if (!q) {
        q = {
          queue: '', loggedin: 0, available: 0, callers: 0, currentCalls: 0, cumulativeHoldTime: 0, cumulativeTalkTime: 0, avgHoldTime: 0, avgTalkTime: 0, longestholdtime: 0, completed: 0, abandoned: 0, totalCalls: 0
        };
        Queues.push(q);
      }
      q.queue = evt.queue; // ybao: avoid creating multiple queue elements for the same queue
      // evt.abandoned = number of calls that have been abandoned for this queue
      q.abandoned = Number(evt.abandoned);
      // check for stats in the database
      // get this queue from the stored stats
      const tempQ = findQueueFromStats(q.queue);
      // use the call stats from Mongo
      if (tempQ) {
        q.completed = Number(evt.completed) + tempQ.completed;
        q.abandoned = Number(evt.abandoned) + tempQ.abandoned;
        q.totalCalls = q.completed + q.abandoned;
      } else {
        q.completed = Number(evt.completed);
        q.abandoned = Number(evt.abandoned);
        q.totalCalls = q.completed + q.abandoned;
      }
      break;
    }
    case 'QueueSummary':
    {
      for (let j = 0; j < AsteriskQueuenames.length; j += 1) {
        // QueueSummary: evt.queue
        if (evt.queue === AsteriskQueuenames[j]) {
          q = findQueue(evt.queue);
          if (!q) {
            q = {
              queue: '', loggedin: 0, available: 0, callers: 0, currentCalls: 0, cumulativeHoldTime: 0, cumulativeTalkTime: 0, avgHoldTime: 0, avgTalkTime: 0, longestholdtime: 0, completed: 0, abandoned: 0, totalCalls: 0
            };
            Queues.push(q);
          }
          q.queue = evt.queue; // evt.queue = name of the queue ("eg. ComplaintsQueue")
          q.loggedin = Number(evt.loggedin); // evt.loggedin = number of agents currently logged in
          q.available = Number(evt.available); // evt.available = number of agents available
          // evt.callers = number of calls currently waiting in the queue to be answered
          q.callers = Number(evt.callers);

          const tempQ = findQueueFromStats(evt.queue);
          /**
           * If the following fields are zero, we can assume that this is the first
           * time the server has started, so we set each field to it respective value from
           * Mongo
           */
          if (tempQ) {
            if (q.cumulativeHoldTime === 0 && tempQ.cumulativeHoldTime > 0) {
              q.cumulativeHoldTime = tempQ.cumulativeHoldTime;
            }
            if (q.cumulativeTalkTime === 0 && tempQ.cumulativeTalkTime > 0) {
              q.cumulativeTalkTime = tempQ.cumulativeTalkTime;
            }
            if (q.longestholdtime === 0 && tempQ.longestholdtime > 0) {
              q.longestholdtime = tempQ.longestholdtime;
            }
            if (q.completed === 0 && tempQ.completed > 0) {
              q.completed = tempQ.completed;
            }
            if (q.abandoned === 0 && tempQ.abandoned > 0) {
              q.abandoned = tempQ.abandoned;
            }
          }
          if (q.completed > 0) {
            q.avgHoldTime = Number((q.cumulativeHoldTime / q.completed) / 60).toFixed(2);
            q.avgTalkTime = Number((q.cumulativeTalkTime / q.completed) / 60).toFixed(2);
          }
          // QueueSummary(): q.talktime
        }
      }
      break;
    }
    case 'QueueStatusComplete': // ready to send to the portal
    {
      // QueueStatusComplete received
      sendEmit('queue-resp', {
        queues: Queues
      });
      sendEmit('agent-resp', {
        agents: Agents
      });
      break;
    }
    case 'QueueMemberRemoved':
    {
      // set all Agent status to logoff, but do not send a emit, wait for amiaction.
      // Continue to issue an amiaction
      setAgentsLogOff();
      amiaction({
        action: 'QueueStatus'
      });
      break;
    }
    case 'AgentLogin':
    case 'AgentLogoff':
    case 'QueueMemberAdded':
    {
      amiaction({
        action: 'QueueStatus'
      });
      break;
    }
    case 'QueueStatus':
    case 'Cdr':
    case 'Queues':
    case 'AgentsComplete':
    case 'QueueSummaryComplete':
      break;
    default:
      break;
  }
}

/**
 * Instantiate connection to Asterisk
 * @returns {undefined} Not used
 */
function InitAmi() {
  if (ami === null) {
    try {
      ami = new AsteriskManager(parseInt(getConfigVal('asterisk:ami:port'), 10),
        getConfigVal(ASTERISK_SIP_PRIVATE_IP),
        getConfigVal('asterisk:ami:id'),
        getConfigVal('asterisk:ami:passwd'), true);

      ami.keepConnected();
      ami.on('managerevent', HandleManagerEvent);
    } catch (exp) {
      logger.error('Init AMI error ');
    }
  }
}

/**
 * Initialize the AMI connection.
 */
InitAmi();

/**
 * Initiate amiAction
 * @returns {undefined} Not used
 */
function callAmiActions() {
  amiaction({
    action: 'Agents'
  });
  amiaction({
    action: 'QueueSummary'
  });
  for (let i = 0; i < Queues.length; i += 1) {
    amiaction({
      action: 'QueueStatus',
      Queue: Queues[i].queue
    });
  }
}

/**
 * Retrieve agent information from the Provider
 * @param {type} callback
 * @returns {undefined} Not used
 */
function getAgentsFromProvider(callback) {
  const urlGetAllAgentRecs = `https://${getConfigVal(COMMON_PRIVATE_IP)}:${parseInt(getConfigVal(AGENT_SERVICE_PORT), 10)}/getallagentrecs`;
  request({
    url: urlGetAllAgentRecs,
    json: true
  }, (err, res, dataIn) => {
    let data = dataIn;
    if (err) {
      logger.error('getAgentsFromProvider ERROR  ');
      data = {
        message: 'failed'
      };
    } else {
      callback(data);
    }
  });
}

/**
 * Save agent name and extension in the agentMap
 * @returns {undefined} Not used
 */
function mapAgents() {
  getAgentsFromProvider((data) => {
    Object.keys(data.data).forEach((i) => {
      if (data.data[i].extension) {
        const ext = data.data[i].extension;
        let queues = '--';
        if (data.data[i].queue_name !== null) {
          queues = data.data[i].queue_name;
          if (data.data[i].queue2_name !== null) {
            queues += `, ${data.data[i].queue2_name}`;
          }
        }
        const usr = {
          name: `${data.data[i].first_name} ${data.data[i].last_name}`,
          queues
        };
        AgentMap.set(ext, usr);
        // console.log(JSON.stringify(AgentMap,undefined,2))
      }
    });

    // for (const i in data.data) {
    //   if (data.data[i].extension) {
    //     const ext = data.data[i].extension;
    //     let queues = '--';
    //     if (data.data[i].queue_name !== null) {
    //       queues = data.data[i].queue_name;
    //       if (data.data[i].queue2_name !== null) {
    //         queues += `, ${data.data[i].queue2_name}`;
    //       }
    //     }
    //     const usr = {
    //       name: `${data.data[i].first_name} ${data.data[i].last_name}`,
    //       queues
    //     };
    //     AgentMap.set(ext, usr);
    //     // console.log(JSON.stringify(AgentMap,undefined,2))
    //   }
    // }
  });
}

/**
 * Server-db initialziation
 * @returns {undefined} Not used
 */
function initialize() {
  mapAgents();
  callAmiActions();
  resetAllCounters();

  setInterval(() => {
    callAmiActions();
    mapAgents();
  }, pollInterval);

  if (logStats && logStatsFreq > 0) {
    setInterval(() => {
      backupStatsinDB();
    }, logStatsFreq);
  }
}

// calls sendResourceStatus every minute
setInterval(sendResourceStatus, 60000);
setImmediate(initialize);

app.use((err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') return next(err);
  // handle CSRF token errors here
  return res.status(200).json({
    message: 'Form has been tampered'
  });
});

/**
 * Calls the RESTful service running on the provider host to verify the agent
 * username and password.
 *
 * @param {type} username Agent username
 * @param {type} password Agent password
 * @param {type} callback Returns retrieved JSON
 * @returns {undefined} Not used
 */
function getUserInfo(username, callback) {
  const urlGetAgentRec = `https://${getConfigVal(COMMON_PRIVATE_IP)}:${parseInt(getConfigVal(AGENT_SERVICE_PORT), 10)}/getagentrec/${username}`;
  request({
    url: urlGetAgentRec,
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
 * Handles all GET request to server
 * determines if user can procede or
 * before openam cookie shield is enforced
 */
app.use((req, res, next) => {
  if (req.path === nginxPath || req.path === '/agentassist') {
    next();
  } else if (req.path === '/logout') {
    next();
  } else if (req.session !== null && req.session.data) {
    if (req.session.data !== null && req.session.data.uid) {
      if (req.session.role) {
        return next(); // user is logged in go to next()
      }

      const username = req.session.data.uid;
      getUserInfo(username, (user) => {
        if (user.message === 'success') {
          req.session.agent_id = user.data[0].agent_id;
          req.session.role = user.data[0].role;
          req.session.username = user.data[0].username;
          return next();
        }
        return res.redirect('./');
      });
    }
  } else {
    return res.redirect(`.${nginxPath}`);
  }
  return null;
});

/**
 * Get Call for Agent Assistance
 * @param {type} param1 Extension
 * @param {type} param2 Response
 */
app.use('/agentassist', (req, res) => {
  logger.info('Agent Assistance');
  if (req.query.extension) {
    sendEmit('agent-request', req.query.extension);
    res.send({
      message: 'Success'
    });
  } else {
    res.send({
      message: 'Error'
    });
  }
});

// must come after above function
// All get requests below are subjected to openam cookieShield

app.use((req, res, next) => {
  res.locals = {
    nginxPath
  };
  next();
});

app.use('/', require('./routes'));

/**
 * Reset Asterisk stat counters
 * @param {type} param1 Not used
 * @param {function} 'agent.shield(cookieShield)'
 * @param {type} param2 Not used
 */
app.get('/resetAllCounters', policyAgent.shield(cookieShield), () => {
  logger.info('GET Call to reset counters');
  resetAllCounters();
  mapAgents();
});

/**
 * Handles a GET request for /getVideoamil to retrieve the videomail file
 * @param {string} '/getVideomail'
 * @param {function} function(req, res)
 */
app.get('/getVideomail', (req, res) => {
  console.log('/getVideomail');
  const videoId = req.query.id;
  const { agent } = req.query;
  console.log(`id: ${videoId}`);

  // Wrap in mysql query
  dbConnection.query('SELECT video_filepath AS filepath, video_filename AS filename FROM videomail WHERE id = ?', videoId, (errQuery, result) => {
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
        io.to(agent).emit('videomail-retrieval-error', videoId);
      }
    }
  });
});
