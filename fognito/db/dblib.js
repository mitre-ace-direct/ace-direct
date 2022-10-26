// dblibs.js
const { MongoClient } = require('mongodb');
const fs = require('fs');
const neatCsv = require('neat-csv');
const User = require('../app/models/user');
const getconfig = require('./getconfig');

const userObj = new User();

// create Mongo URI
const mongoUser = '';
const mongoPass = '';
const mongoHost = getconfig.getConfigVal('servers:mongodb_fqdn');
const mongoPort = getconfig.getConfigVal('app_ports:mongodb');
const mongoDbname = getconfig.getConfigVal('database_servers:mongodb:database_name');
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
          client.close();
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
          client.close();
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
          client.close();
          reject(new Error(`Error: ${err1}`));
          return;
        }
        if (res && res.result && res.result.n > 0) {
          const count = res.result.n;
          client.close();
          resolve(count);
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
          const count = res.result.n;
          client.close();
          resolve(count);
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
          client.close();
          reject(new Error(`Error: ${err1}`));
          return;
        }
        if (res && res.insertedCount > 0) {
          const count = res.insertedCount;
          client.close();
          resolve(count);
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
