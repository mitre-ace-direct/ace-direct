require('dotenv').config();
const WebServer = require('./web_frontend');
const SessionIndex = require('./session_index');
const ConfManager = require('./conf_manager');
const AmiManager = require('./ami_manager');
const param = require('param');
const debug = require('debug')('ace:main');
const mysql = require('mysql2');

async function main() {
  try {

    const dbHost = param('servers.mysql_fqdn');
    const dbUser = param('database_servers.mysql.user');
    const dbPassword = param('database_servers.mysql.password');
    const dbName = param('database_servers.mysql.ad_database_name');
    const dbPort = parseInt(param('app_ports.mysql'));

    // check for required media server table, if not there, abort with an error
    const con2 = mysql.createConnection(
      {
        host: dbHost,
        user: dbUser,
        password: dbPassword,
        database: 'media_server',
        port: dbPort
      }
    );
    const sqlQuery = 'select count(*) from ace_direct_webrtc_session';
    con2.promise().query(sqlQuery)
      .catch((e) => {
        con2.end();
        console.error('\n\n****************************************\n');
        console.error(`!!! ERROR !!! >${e}<\n`);
        console.error('TO FIX THIS, RUN: cd ~/ace-direct; npm run config\n');
        console.error('exiting...');
        console.error('\n****************************************\n\n');
        process.exit(99);
      })
      .then(() => {
        console.info('Ok - media_server table found.');
        con2.end();
      });

    debug('Starting ACE app...');
    const ix = new SessionIndex();
    const conf = new ConfManager(ix);
    const server = new WebServer();
    const amiEnabled = param('asteriskss.ami.enabled');
    const ami = (amiEnabled) ? new AmiManager() : null;
    server.on('connection', (session) => {
      ix.register(session, conf, ami);
    });
    await server.start();
    if (ami) await ami.init_ami();
  } catch (error) {
    debug('Fatal error', error);
  }
}

main(process.argv.splice(2));
