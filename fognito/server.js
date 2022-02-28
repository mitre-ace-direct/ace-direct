const path = require('path');
const express = require('express');
const https = require('https');
const fs = require('fs');
const mongoose = require('mongoose');
const passport = require('passport');
const flash = require('connect-flash');
const session = require('express-session');
var MongoDBStore = require('connect-mongodb-session')(session);
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const favicon = require('serve-favicon');
const mysql = require('mysql');
const config = require('./config');
require('./config/passport')(passport);
const User = require('./app/models/user');

let dbConnection = null;
dbConnection = mysql.createConnection({
  host: config.db.mysql.host,
  user: config.db.mysql.user,
  password: config.db.mysql.pass,
  database: config.db.mysql.dbname,
  port: config.db.mysql.port
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

// verify config file
let content = '';
try {
  content = JSON.stringify(config, null, 4);
  JSON.parse(content);
  console.log('Valid JSON config file.');
} catch (ex) {
  console.log('\n***********************************************************');
  console.log('Error! server.js - Malformed configuration file:  config.js\nExiting...');
  console.log('***********************************************************\n');
  process.exit(1);
}

const credentials = {
  key: fs.readFileSync(config.secure.key),
  cert: fs.readFileSync(config.secure.cert)
};

const sessionSecret = config.app.session.secret;

// connect to Mongo
let dbURI = '';
if (config.db.mongo.user && config.db.mongo.user.length > 0
  && config.db.mongo.pass && config.db.mongo.pass.length > 0) {
  dbURI = `mongodb://${config.db.mongo.host}:${config.db.mongo.port}/${config.db.mongo.dbname}`;
} else {
  dbURI = `mongodb://${config.db.mongo.host}:${config.db.mongo.port}/${config.db.mongo.dbname}`;
}
console.log(dbURI);
const app = express();

mongoose.connect(dbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

var store = new MongoDBStore({
  uri: dbURI,
 collection: 'mySessions'
});

//const sessionMiddleware = session({ secret: sessionSecret, resave: true, saveUninitialized: true });
const sessionMiddleware = session({ secret: sessionSecret, resave: true, saveUninitialized: true, store});

app.use(express.static(path.join(__dirname, 'public')));
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

app.locals = require('./helpers/home');

require('./app/routes')(app, passport, config, User, dbConnection);

const httpsServer = https.createServer(credentials, app);

httpsServer.listen(config.port);

console.log('Running... \n');
console.log(`🚀 https://localhost:${config.port}`);

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
// END
