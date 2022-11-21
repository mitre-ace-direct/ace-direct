/* eslint-disable camelcase */
const path = require('path');
const express = require('express');
const https = require('https');
const fs = require('fs');
const mongoose = require('mongoose');
const passport = require('passport');
const flash = require('connect-flash');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const favicon = require('serve-favicon');
const mysql = require('mysql');
const nconf = require('nconf');
require('./config/passport')(passport);
const User = require('./app/models/user');

let dbConnection = null;

function myCleanup() {
  if (dbConnection) {
    dbConnection.destroy();
  }
}
require('./cleanup').Cleanup(myCleanup);

// use global AD config file
const cfile = '../dat/config.json';
let clearText = false;
const content = fs.readFileSync(cfile, 'utf8');
try {
  JSON.parse(content);
  console.log('Valid JSON config file');
} catch (ex) {
  console.log('\n*******************************************************');
  console.log(`Error! Malformed configuration file: ${cfile}`);
  console.log('Exiting...');
  console.log('*******************************************************\n');
  process.exit(1);
}
nconf.file({ file: cfile });
if (typeof (nconf.get('common:cleartext')) !== 'undefined' && nconf.get('common:cleartext') !== '') {
  clearText = true;
}

function getConfigVal(paramName) {
  const val = nconf.get(paramName);
  let decodedString = null;
  if (typeof val !== 'undefined' && val !== null) {
    decodedString = null;
    if (clearText) {
      decodedString = val;
    } else {
      decodedString = Buffer.alloc(val.length, val, 'base64');
    }
  } else {
    console.error('\n*******************************************************');
    console.error(`ERROR!!! Config parameter is missing: ${paramName}`);
    console.error('*******************************************************\n');
    decodedString = '';
  }
  return (decodedString.toString());
}

// agent portal customizations || defaults
const customizationDefaults = {
  agentPortalLoginLogo: 'public/images/AD-logo-trim.png',
  agentPortalLoginEmail: 'info@email.com',
  agentPortalLoginPhone: '111-222-3333',
  agentPortalLoginDisclaimer: 'You are entering an official system, which may be used only for authorized purposes. Unauthorized use of this website is prohibited.'
};

function getCustomValue(customization) {
  return (getConfigVal(`customizations:${customization}`).length > 0) ? getConfigVal(`customizations:${customization}`) : customizationDefaults[customization];
}

const agentPortalLoginLogo = getCustomValue('agentPortalLoginLogo');
const agentPortalLoginEmail = getCustomValue('agentPortalLoginEmail');
const agentPortalLoginPhone = getCustomValue('agentPortalLoginPhone');
const agentPortalLoginDisclaimer = getCustomValue('agentPortalLoginDisclaimer');

// nginx params
const ad_path = getConfigVal('nginx:ad_path');
const mp_path = getConfigVal('nginx:mp_path');
const agent_route = getConfigVal('nginx:agent_route');
const consumer_route = getConfigVal('nginx:consumer_route');
const nginx_params = {
  ad_path, mp_path, agent_route, consumer_route
};

// mongo params
const mongoUser = '';
const mongoPass = '';
const mongoHost = getConfigVal('servers:mongodb_fqdn');
const mongoPort = getConfigVal('app_ports:mongodb');
const mongoDbname = getConfigVal('database_servers:mongodb:database_name');

// mysql params
const mysqlUser = getConfigVal('database_servers:mysql:user');
const mysqlPass = getConfigVal('database_servers:mysql:password');
const mysqlHost = getConfigVal('servers:mysql_fqdn');
const mysqlPort = getConfigVal('app_ports:mysql');
const mysqlDbname = getConfigVal('database_servers:mysql:ad_database_name');

dbConnection = mysql.createConnection({
  host: mysqlHost,
  user: mysqlUser,
  password: mysqlPass,
  database: mysqlDbname,
  port: mysqlPort
});

dbConnection.connect((err) => {
  if (err !== null) {
    // MySQL connection ERROR
    console.error('\n*************************************');
    console.error('ERROR connecting to MySQL. Exiting...');
    console.error(err);
    console.error('*************************************\n');
  } else {
    // SUCCESSFUL connection
  }
});
setInterval(() => {
  dbConnection.ping(); // Keeps connection from Inactivity Timeout
}, 60000);

const credentials = {
  key: fs.readFileSync(getConfigVal('common:https:private_key')),
  cert: fs.readFileSync(getConfigVal('common:https:certificate'))
};

const sessionSecret = getConfigVal('fognito:session_secret');

// connect to Mongo
let dbURI = '';
if (mongoUser && mongoUser.length > 0 && mongoPass && mongoPass.length > 0) {
  dbURI = `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:${mongoPort}/${mongoDbname}`;
} else {
  dbURI = `mongodb://${mongoHost}:${mongoPort}/${mongoDbname}`;
}
const app = express();

mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const store = new MongoDBStore({
  uri: dbURI,
  collection: 'mySessions'
});

const sessionMiddleware = session({
  secret: sessionSecret, resave: true, saveUninitialized: true, store
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../acedirect')));
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session
app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));

app.use((req, res, next) => {
  res.locals = {
    agentPortalLoginLogo,
    agentPortalLoginEmail,
    agentPortalLoginPhone,
    agentPortalLoginDisclaimer
  };
  next();
});

app.locals = require('./helpers/home');

require('./app/routes')(app, passport, User, dbConnection, nginx_params);

const httpsServer = https.createServer(credentials, app);

const port = getConfigVal('app_ports:fognito');
const appServer = httpsServer.listen(port);

console.log('Running... \n');
console.log(`🚀 https://localhost:${port}`);

function handleExit(signal) {
  console.log(`Received ${signal}. Shutting down.`);
  mongoose.connection.close();

  if (dbConnection) {
    dbConnection.destroy();
  }

  console.log('Process terminated');
  process.exit(0);
}
process.on('SIGINT', handleExit);
process.on('SIGQUIT', handleExit);
process.on('SIGTERM', handleExit);

module.exports = app;
module.exports = appServer;
module.exports.myCleanup = myCleanup;
// END
