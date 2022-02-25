// generic get documents for all collections

// create a client to access MongoDB
const { MongoClient } = require('mongodb');
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
  console.log('usage: node doc_get.js <collection name>');
  process.exit(99);
}

const coll = process.argv[2];
MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true }, (err, client) => {
  if (err) throw err;

  const dbo = client.db(config.db.mongo.dbname);

  dbo.collection(coll).find({}).toArray((err1, res) => {
    if (err) {
      console.log(`Error: ${err}`);
      return;
    }
    if (res && res.length > 0) {
      console.log(JSON.stringify(res, null, 4));
    } else {
      console.log(`No documents in collection: ${coll}`);
    }
    client.close();
  });
});
