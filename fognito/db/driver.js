// driver program that tests dblib.js functions
const dblib = require('./dblib');

const go = async () => {
  // delete all documents, start clean
  console.log(await dblib.deleteDocuments('users'));

  // add all users
  const obj = await dblib.readCsvFile('./data/users.csv');
  console.log(await dblib.addToUsers(obj));

  // delete some users
  // const userArr = ['customer1','customer2'];
  // console.log(await dblib.deleteUsers(userArr));

  // get some documents
  console.log(await dblib.getDocuments('users'));
};

go();
