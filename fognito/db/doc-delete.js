// generic delete documents script

// create a client to access MongoDB
const { MongoClient } = require('mongodb');

const stdin = process.openStdin();
const config = require('../config');

// create Mongo URI
let uri = '';
if (config.db.mongo.user && config.db.mongo.user.length > 0
  && config.db.mongo.pass && config.db.mongo.pass.length > 0) {
  uri = `mongodb://${config.db.mongo.user}:${config.db.mongo.pass}@${config.db.mongo.host}:${config.db.mongo.port}/${config.db.mongo.dbname}`;
} else {
  uri = `mongodb://${config.db.mongo.host}:${config.db.mongo.port}/${config.db.mongo.dbname}`;
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

    const dbo = client.db(config.db.mongo.dbname);

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
