// generic delete documents script

// create a client to access MongoDB
const fs = require('fs');
const nconf = require('nconf');
const { MongoClient } = require('mongodb');

const stdin = process.openStdin();

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
  console.log('usage: node doc_delete.js <collection name>');
  process.exit(99);
}

const coll = process.argv[2];

// ADMINISTRATION: delete all documents from the db
const deleteAllDocuments = () => new Promise((resolve, reject) => {
  MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
    if (err) throw err;

    const dbo = client.db(mongoDbname);

    dbo.collection(coll).deleteMany({}, (err1, res) => {
      if (err) {
        reject(new Error(`Error: ${err}`));
        client.close();
        return;
      }
      if (res && res.result && res.result.n > 0) {
        resolve(`${res.result.n} document(s) deleted`);
        client.close();
        return;
      }
      resolve(`no documents to delete from: ${coll}`);
    });
  });
});

const deleteDocuments = async () => {
  console.log(await deleteAllDocuments());
  process.exit(0);
};

console.log('*** WARNING ***');
console.log(`*** THIS IS DESTRUCTIVE!!! IT WILL DELETE ALL DOCUMENTS FROM: ${coll} ***`);
console.log('*** IF YOU ARE SURE YOU WANT TO DO THIS ENTER: xyzzy');
process.stdout.write('==> ');
stdin.addListener('data', (d) => {
  // trim newline from input
  const userInput = d.toString().trim();
  if (userInput === 'xyzzy') {
    deleteDocuments();
  } else {
    console.log('Documents NOT deleted.');
    process.exit(0); // EXIT INPUT LISTENER
  }
});
