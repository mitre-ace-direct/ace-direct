// generic get documents for all collections

// create a client to access MongoDB
const path = require('path');
const { MongoClient } = require('mongodb');
const getconfig = require('./getconfig');

const programName = path.basename(process.argv[1]);

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

if (process.argv.length !== 3) {
  console.log(`usage: node ${programName} <collection name>`);
  process.exit(99);
}

const coll = process.argv[2];
MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
  if (err) throw err;

  const dbo = client.db(mongoDbname);

  dbo.collection(coll).find({}).toArray((err1, res) => {
    if (err) {
      console.log(`Error: ${err}`);
      return;
    }
    if (res && res.length > 0) {
      console.log(JSON.stringify(res, null, 4));
      console.log(`num recs: ${res.length}`);
    } else {
      console.log(`No documents in collection: ${coll}`);
    }
    client.close();
  });
});
