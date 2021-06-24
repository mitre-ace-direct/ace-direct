const redis = require('async-redis');
const param = require('param');

const client  = redis.createClient(param('database_servers.redis.host'), param('database_servers.redis.host'));
client.auth(param('database_servers.redis.auth'));
client.on('error', function (err) {
  console.log('could not establish a connection with redis. ' + err);
});
client.on('connect', function (err) {
  console.log('connected to redis successfully');
});

module.exports =  client; 