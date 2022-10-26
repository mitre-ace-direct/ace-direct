// generic delete documents script

// create a client to access MongoDB
const path = require('path');
const { MongoClient } = require('mongodb');
const getconfig = require('./getconfig');

const stdin = process.openStdin();
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
