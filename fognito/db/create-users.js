// create FOGNITO users
// NOTE:
// * This will delete the FOGNITO user and add it again.
// * Useful for changing an agent or manager's password
// REQUIREMENTS:
// * ace-direct/dat/config.json must be configured and complete
// * This program adds users on the FOGNITO side. There must
//   be a corresponding user in MySQL for login to work.

// create a client to access MongoDB
const path = require('path');
const { MongoClient } = require('mongodb');
const getconfig = require('./getconfig');
const User = require('../app/models/user');

const userObj = new User();

const arole = 'AD Agent';
const mrole = 'Manager';
const colUsers = 'users';

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

const programName = path.basename(process.argv[1]);
if (process.argv.length !== 7) {
  console.log(`\nusage: node ${programName} <id> <password> <role: ${mrole}|${arole}> <email> <display name>\n`);
  console.log(`\n  e.g. node ${programName} dagent1 abc "${arole}" dagent1@mail.com  "Alice Smith"\n`);
  process.exit(99);
}

const idArg = process.argv[2];
const passArg = process.argv[3];
const roleArg = process.argv[4];
const emailArg = process.argv[5];
const dnameArg = process.argv[6];

if (roleArg !== arole && roleArg !== mrole) {
  console.log(`\nerror: role must be either ${arole} or ${mrole}.\n`);
  process.exit(99);
}

const deleteUser = (id) => new Promise((resolve, reject) => {
  // delete all users that match username: id
  MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
    if (err) throw err;
    const dbo = client.db(mongoDbname);
    const myquery = { 'local.id': id };
    dbo.collection(colUsers).deleteMany(myquery, (err1, res) => {
      if (err) {
        client.close();
        reject(new Error(`Error: ${err}`));
        return;
      }
      let count = 0;
      if (res && res.deletedCount > 0) {
        count = res.deletedCount;
      }
      client.close();
      resolve(`${count} document(s) deleted`);
    });
  });
});

const addUser = (id, password, role, email, displayName) => new Promise((resolve, reject) => {
  MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
    if (err) return reject(new Error(err));
    const dbo = client.db(mongoDbname);
    const hpassword = userObj.generateHash(password);
    const obj = {
      local: {
        id,
        email,
        password: hpassword,
        role,
        displayName
      }
    };
    return dbo.collection(colUsers).insertOne(obj, (err1, res) => {
      if (err1) {
        client.close();
        reject(new Error(`Error: ${err1}`));
        return;
      }
      let count = 0;
      if (res && res.acknowledged) {
        count = 1;
      }
      client.close();
      resolve(`${count} document(s) added`);
    });
  });
});

const getUser = (id) => new Promise((resolve, reject) => {
  MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
    if (err) return reject(new Error(err));
    const dbo = client.db(mongoDbname);
    return dbo.collection(colUsers).find({ 'local.id': id }).toArray((err1, res) => {
      if (err1) {
        client.close();
        reject(new Error(`Error: ${err1}`));
        return;
      }
      let count = 0;
      if (res && res.length > 0) {
        count = res.length;
      }
      client.close();
      resolve(`${count} document(s) found`);
    });
  });
});

const go = async () => {
  const resp = await deleteUser(idArg);
  console.log(`${resp}`);

  const resp2 = await addUser(idArg, passArg, roleArg, emailArg, dnameArg);
  console.log(`${resp2}`);

  const resp3 = await getUser(idArg);
  console.log(`${resp3}`);

  process.exit(0);
};

go();
