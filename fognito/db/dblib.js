// dblibs.js
const { MongoClient } = require('mongodb');
const fs = require('fs');
const neatCsv = require('neat-csv');
const nconf = require('nconf');
const User = require('../app/models/user');

const userObj = new User();

// use global AD config file
const cfile = '../../dat/config.json';
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
    logger.error('\n*******************************************************');
    logger.error(`ERROR!!! Config parameter is missing: ${paramName}`);
    logger.error('*******************************************************\n');
    decodedString = '';
  }
  return (decodedString.toString());
}

// create Mongo URI
let mongoUser = '';
let mongoPass = '';
let mongoHost = getConfigVal('servers:mongodb_fqdn');
let mongoPort = getConfigVal('app_ports:mongodb');
let mongoDbname = getConfigVal('database_servers:mongodb:database_name');
let uri = '';
if (mongoUser && mongoUser.length > 0 && mongoPass && mongoPass.length > 0) {
  uri = `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:${mongoPort}/${mongoDbname}`;
} else {
  uri = `mongodb://${mongoHost}:${mongoPort}/${mongoDbname}`;
}

const collUsers = 'users';

module.exports = {
  getDocuments: (collName) => new Promise((resolve, reject) => {
    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
      if (err) return reject(new Error(err));
      const dbo = client.db(mongoDbname);
      return dbo.collection(collName).find({}).toArray((err1, res) => {
        if (err1) {
          reject(new Error(`Error: ${err1}`));
          return;
        }
        if (res && res.length > 0) {
          resolve(res);
        } else {
          resolve([]);
        }
        client.close();
      });
    });
  }),
  getUserInfo: (id) => new Promise((resolve, reject) => {
    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
      if (err) return reject(new Error(err));
      const dbo = client.db(mongoDbname);
      return dbo.collection(collUsers).find({ 'local.id': id }).toArray((err1, res) => {
        if (err1) {
          reject(new Error(`Error: ${err1}`));
          return;
        }
        if (res && res.length > 0) {
          resolve(res);
        } else {
          resolve(null); // no result
        }
        client.close();
      });
    });
  }),
  deleteDocuments: (collName) => new Promise((resolve, reject) => {
    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
      if (err) return reject(new Error(err));
      const dbo = client.db(mongoDbname);
      return dbo.collection(collName).deleteMany({}, (err1, res) => {
        if (err1) {
          reject(new Error(`Error: ${err1}`));
          client.close();
          return;
        }
        if (res && res.result && res.result.n > 0) {
          resolve(res.result.n);
          client.close();
          return;
        }
        client.close();
        resolve(0); // no documents deleted
      });
    });
  }),
  deleteUsers: (userArray) => new Promise((resolve, reject) => {
    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
      if (err) return reject(new Error(err));
      const dbo = client.db(mongoDbname);
      const myQuery = { 'local.id': { $in: userArray } };
      return dbo.collection(collUsers).deleteMany(myQuery, (err1, res) => {
        if (err1) {
          reject(new Error(`Error: ${err1}`));
          client.close();
          return;
        }
        if (res && res.result && res.result.n > 0) {
          resolve(res.result.n);
          client.close();
          return;
        }
        client.close();
        resolve(0); // no documents deleted
      });
    });
  }),
  addToUsers: (userArray) => new Promise((resolve, reject) => {
    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
      if (err) return reject(new Error(err));
      const dbo = client.db(mongoDbname);
      return dbo.collection(collUsers).insertMany(userArray, (err1, res) => {
        if (err1) {
          reject(new Error(`Error: ${err1}`));
          client.close();
          return;
        }
        if (res && res.insertedCount > 0) {
          resolve(res.insertedCount);
          client.close();
          return;
        }
        client.close();
        resolve(0);
      });
    });
  }),
  readCsvFile: (csvFile) => new Promise((resolve, reject) => {
    fs.readFile(csvFile, async (err, data) => {
      if (err) {
        reject(new Error(err));
        return;
      }
      const obj = await neatCsv(data);
      const arrFinal = [];
      for (let i = 0; i < obj.length; i += 1) {
        const objNew = {};
        obj[i].password = userObj.generateHash(obj[i].password);
        objNew.local = obj[i];
        arrFinal.push(objNew);
      }
      resolve(arrFinal);
    });
  }),
  foo: () => new Promise((resolve, _reject) => {
    resolve('foo');
  })
};
