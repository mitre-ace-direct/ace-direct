// const nconf = require('nconf');
const mysql = require('mysql');
// const fs = require('fs');

// get params
let mysqlFqdn = '';
let mysqlUser = '';
let mysqlPass = '';
let mysqlDb = '';
if (process.argv.length === 6) {
  [, , mysqlFqdn, mysqlUser, mysqlPass, mysqlDb] = process.argv;
} else {
  console.log('\nusage: node checkMysql.js  <mysql fqdn>  <mysql user>  <mysql password>  <mysql database>\n');
  process.exit(process.argv.length);
}

// Create MySQL connection and connect to it
const connection = mysql.createConnection({
  host: mysqlFqdn,
  user: mysqlUser,
  password: mysqlPass,
  database: mysqlDb
});

const connectToMysql = () => new Promise((resolve, reject) => {
  connection.connect((err) => {
    if (err) {
      reject(new Error('connect error'));
    }
    resolve(0);
  });
});

const disconnectFromMysql = () => new Promise((resolve, reject) => {
  connection.end((err) => {
    if (err) {
      reject(new Error('disconnect error'));
    }
    resolve(0);
  });
});

const go = async () => {
  let connectRc = 99;
  try {
    connectRc = await connectToMysql();
  } catch (e) {
    connectRc = 99;
  }

  let disconnectRc = 99;
  try {
    disconnectRc = await disconnectFromMysql();
  } catch (e) {
    disconnectRc = 99;
  }

  connection.destroy();
  if (connectRc === 0 && disconnectRc === 0) {
    console.log(0);
  } else {
    console.log(99);
  }
};

go();
