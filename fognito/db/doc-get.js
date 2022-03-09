// generic get documents for all collections

// create a client to access MongoDB
const fs = require('fs');
const nconf = require('nconf');
const { MongoClient } = require('mongodb');

// create Mongo URI
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
    console.error('\n*******************************************************');
    console.error(`ERROR!!! Config parameter is missing: ${paramName}`);
    console.error('*******************************************************\n');
    decodedString = '';
  }
  return (decodedString.toString());
}

// create Mongo URI
const mongoUser = '';
const mongoPass = '';
const mongoHost = getConfigVal('servers:mongodb_fqdn');
const mongoPort = getConfigVal('app_ports:mongodb');
const mongoDbname = getConfigVal('database_servers:mongodb:database_name');
let uri = '';
if (mongoUser && mongoUser.length > 0 && mongoPass && mongoPass.length > 0) {
  uri = `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:${mongoPort}/${mongoDbname}`;
} else {
  uri = `mongodb://${mongoHost}:${mongoPort}/${mongoDbname}`;
}

if (process.argv.length !== 3) {
  console.log('usage: node doc_get.js <collection name>');
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
