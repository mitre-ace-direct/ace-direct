// dblibs.js
const { MongoClient } = require('mongodb');
const fs = require('fs');
const neatCsv = require('neat-csv');
const config = require('../config');
const User = require('../app/models/user');

const userObj = new User();

// create Mongo URI
let uri = '';
if (config.db.mongo.user && config.db.mongo.user.length > 0
  && config.db.mongo.pass && config.db.mongo.pass.length > 0) {
  uri = `mongodb://${config.db.mongo.user}:${config.db.mongo.pass}@${config.db.mongo.host}:${config.db.mongo.port}/${config.db.mongo.dbname}`;
} else {
  uri = `mongodb://${config.db.mongo.host}:${config.db.mongo.port}/${config.db.mongo.dbname}`;
}

const collUsers = 'users';

module.exports = {
  getDocuments: (collName) => new Promise((resolve, reject) => {
    MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
      if (err) return reject(new Error(err));
      const dbo = client.db(config.db.mongo.dbname);
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
      const dbo = client.db(config.db.mongo.dbname);
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
      const dbo = client.db(config.db.mongo.dbname);
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
      const dbo = client.db(config.db.mongo.dbname);
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
      const dbo = client.db(config.db.mongo.dbname);
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
