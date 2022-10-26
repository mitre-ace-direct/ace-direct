// create MYSQL users
// NOTE:
// * This will add/update the user in MySQL agent_data
// * Useful for adding/updating MySQL agents or managers
// REQUIREMENTS:
// * ace-direct/dat/config.json must be configured and complete
// * This program adds users on the MYSQLside. There must
//   be a corresponding user in FOGNITO for login to work.
// * Manager users do NOT need to set extension_id, queue_id, or queue2_id

// create a client to access MongoDB
const path = require('path');
const mysql = require('mysql');
const getconfig = require('./getconfig');

const arole = 'AD Agent';
const mrole = 'Manager';

const programName = path.basename(process.argv[1]);
if (process.argv.length !== 3) {
  console.log(`\nusage: node ${programName} <JSON data string>\n`);
  console.log(`\n  e.g. node ${programName} '{"username":"dagent1", "first_name":"Alice", "last_name":"Jones", "role":"AD Agent", "phone":"888-888-8888", "email":"dagent1@mail.com", "organization":"MyOrg", "extension":33001, "queue1":"ComplaintsQueue", "queue2":"GeneralQuestionsQueue"}' # agent \n`);
  console.log(`\n  e.g. node ${programName} '{"username":"manager1", "first_name":"Professor", "last_name":"X", "role":"Manager", "phone":"999.999.9999", "email":"profx@mail.com", "organization":"Cerebro"}' # manager \n`);
  process.exit(99);
}

let jsonObj = null;
try {
  jsonObj = JSON.parse(process.argv[2]);
} catch (e) {
  console.log('\nerror - invalid JSON data string\n');
  process.exit(99);
}

if (!jsonObj.username || !jsonObj.first_name || !jsonObj.last_name || !jsonObj.role
  || !jsonObj.phone || !jsonObj.email || !jsonObj.organization) {
  console.log('\nerror - missing JSON fields\n');
  process.exit(99);
}

if (jsonObj.role !== arole && jsonObj.role !== mrole) {
  console.log('\nerror - invalid role\n');
  process.exit(99);
}

if (jsonObj.role === arole) {
  if (!jsonObj.extension || !jsonObj.queue1 || !jsonObj.queue2) {
    console.log('\nerror - invalid or missing extension, queue1, or queue2 fields\n');
    process.exit(99);
  }
} else {
  // manager
  jsonObj.extension = 0;
  jsonObj.queue1 = 'None';
  jsonObj.queue2 = 'None';
}

// Create MySQL connection
const connection = mysql.createConnection({
  host: getconfig.getConfigVal('servers:mysql_fqdn'),
  user: getconfig.getConfigVal('database_servers:mysql:user'),
  password: getconfig.getConfigVal('database_servers:mysql:password'),
  database: getconfig.getConfigVal('database_servers:mysql:ad_database_name')
});
connection.connect();

// Keeps connection from Inactivity Timeout
setInterval(() => {
  connection.ping();
}, 60000);

const cleanUp = (rc) => {
  if (connection) {
    connection.destroy();
  }
  process.exit(rc);
};

const getExtensions = () => new Promise((resolve, reject) => {
  const extQuery = 'select id,extension from asterisk_extensions';
  connection.query(extQuery, (err, rows) => {
    if (err) {
      console.log(err);
      reject(new Error('asterisk_extensions db query failed.'));
      return;
    }
    if (rows.length > 0) {
      resolve(rows);
    } else {
      console.log('error - no extensions data');
      resolve({});
    }
  });
});

const getQueues = () => new Promise((resolve, reject) => {
  const extQuery = 'select id,queue_name from asterisk_queues';
  connection.query(extQuery, (err, rows) => {
    if (err) {
      console.log(err);
      reject(new Error('asterisk_queues db query failed.'));
      return;
    }
    if (rows.length > 0) {
      resolve(rows);
    } else {
      console.log('error - no queues data');
      resolve({});
    }
  });
});

const deleteUser = (username) => new Promise((resolve, reject) => {
  const extQuery = 'delete from agent_data where username = ?';
  connection.query(extQuery, username, (err, _rows) => {
    if (err) {
      console.log(err);
      reject(new Error('delete failed.'));
      return;
    }
    resolve(true);
  });
});

const addUser = (obj, extId, queue1Id, queue2Id) => new Promise((resolve, reject) => {
  const extQuery = 'INSERT INTO agent_data (username, first_name, last_name, role, phone, email, organization, is_approved, is_active, extension_id, queue_id, queue2_id, layout) '
                + ' VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?);';
  const params = [obj.username, obj.first_name, obj.last_name, obj.role, obj.phone, obj.email, obj.organization, 1, 1, extId, queue1Id, queue2Id, ''];
  connection.query(extQuery, params, (err, rows) => {
    if (err) {
      reject(new Error(err.sqlMessage));
      return;
    }
    if (rows.affectedRows > 0) {
      resolve(true);
      return;
    }
    resolve(false);
  });
});

const getIdForExtension = (ext, arr) => {
  for (let i = 0; i < arr.length; i += 1) {
    if (arr[i].extension === ext) {
      return arr[i].id;
    }
  }
  return -1;
};

const getIdForQueue = (q, arr) => {
  for (let i = 0; i < arr.length; i += 1) {
    if (arr[i].queue_name === q) {
      return arr[i].id;
    }
  }
  return -1;
};

const go = async () => {
  let resp = null;

  resp = await getExtensions();
  const extId = getIdForExtension(jsonObj.extension, resp);
  if (extId === -1) {
    console.log('error - invalid extension');
    cleanUp(-1);
  }

  resp = await getQueues();
  const queue1Id = getIdForQueue(jsonObj.queue1, resp);
  const queue2Id = getIdForQueue(jsonObj.queue2, resp);
  if (queue1Id === -1 || queue2Id === -1) {
    console.log('error - invalid queue1 or queue2');
    cleanUp(-1);
  }

  resp = await deleteUser(jsonObj.username);

  try {
    resp = await addUser(jsonObj, extId, queue1Id, queue2Id);
  } catch (e) {
    console.log(e.message);
    cleanUp(-1);
  }

  cleanUp(0);
};

go();
