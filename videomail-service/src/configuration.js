const dC = require('./../../dat/config.json');

var config = {
	debug: 0, //0: no debug, 1: yes debug 
	clearText: dC.common.cleartext,
	// SIP server configurations
	sipServer: dC.servers.asterisk_fqdn,
	sipWsPort: dC.app_ports.asterisk_ws,
	credArray: dC.videomail.agents,
	// Kurento server configurations
	kurento: {
		protocol : dC.kurento.protocol,
		fqdn: dC.servers.kurento_fqdn,
		ip: dC.servers.kurento_private_ip,
		port: dC.app_ports.kurento,
		path: dC.kurento.path,
		kmsshareport: dC.app_ports.kmsshare
	},
	aserver: {
		fqdn: dC.servers.main_private_ip,
		port: dC.app_ports.aserver
	},
	videomail: {
		fqdn: dC.servers.main_private_ip,
		port: dC.app_ports.videomail
	},
	proxy: dC.common.proxy,
	awsRegion: dC.s3.region,
	awsS3Bucket: dC.s3.bucketname,
	redisHost: dC.servers.redis_fqdn,
	redisPort: dC.app_ports.redis,
	redisAuth: dC.database_servers.redis.auth,
	kmsMediaPath: dC.kurento.mediapath,
	playFileIntro1: dC.videomail.introfile1,
	playFileIntro2: dC.videomail.introfile2,
	playFileIntro3: dC.videomail.introfile3,
	playFileRec: dC.videomail.recordfile,
	recordLength: dC.videomail.max_record_secs
}


if (config.clearText == false) {
	for (key in config) {
		if (key != 'clearText') {
			config[key] = decodeValue(config[key])
		}
	}
}

config.kurentoServer = config.kurento.protocol+"://"+config.kurento.fqdn+":"+config.kurento.port+config.kurento.path;
config.uploadServer = "https://"+config.aserver.fqdn+":"+config.aserver.port;
config.kmsMediaPathURL = "http://"+config.kurento.ip+":"+config.kurento.kmsshareport+"/recordings/";
config.kmsMediaPath = config.kmsMediaPath+"recordings/";
config.videomailServer = "http://"+config.videomail.fqdn+":"+config.videomail.port + "/";

function decodeValue(value) {
	if (typeof value == 'object') {
		value = decodeObject(value)
	} else {
		value = Buffer.from(value, 'base64').toString();
	}
	return value
}

function decodeObject(obj) {
	for (x in obj) {
		obj[x] = decodeValue(obj[x])
	}
	return obj;
}

module.exports = config;
