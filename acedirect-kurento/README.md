# acedirect-kurento

A Web and **signaling server** application that uses Kurento Media Server to make/receive one to one calls to/from Asterisk

## Integration of Kurento with Asterisk

### Pre-Requisites

See [../README.md](../README.md) for full installation, configuration, and deployment details. Follow those instructions to deploy the signaling server.

The sections below are just for background information.

### Configuration

* The `ace-direct/dat/config.json` global configuration file on the deployment server has all the signaling server configuration settings.
* `ace-direct` overall build process creates a symbolic link from `src/config/development.json` to `~/ace-direct/dat/config.json`
* MySQL database parameters are in `src/config/db.js`. This script reads from the global configuration file.
* The `confs/kurento/WebRtcEndpoint.conf.ini` file is generated automatically by the build process.

### To Run locally

#### NPM Build/Run

1. `npm run build` , but if npm hangs, try the yarn build instead `npm run build2`
1. `npm run sequelize db:migrate`
1. `npm run dev  # run it!`
1. Visit this URL in a WebRTC compatible browser to view the demo page: `https://localhost:8443/`

#### Manual Build/Run Steps

1. `npm install`
1. Copy the files in `confs/jssip-modifications`, `RTCSession.js` and `UA.js`, to replace `node_modules/jssip/lib-es5/RTCSession.js` and `node_modules/jssip/lib-es5/UA.js`
1. `npm run bower`
1. `npm run sequelize db:migrate`
1. `cd vendor/kurento-client-js ; npm install`
1. `cd vendor/kurento-jsonrpc ; npm install`
1. `cd vendor/reconnect-ws; npm install`
1. `npm run dev  # run it!`
1. Visit this URL in a WebRTC compatible browser to view the demo page: `https://localhost:8443/`

### With Docker

1) docker build -t {$YOUR_USERNAME}/acedirect-kurento .
2) docker run -p 8443:8443 -d {$YOUR_USERNAME}/acedirect-kurento
3) docker exec -it {$CONTAINER_ID} npm run sequelize db:migrate
4) (Optional. If you want to see the app logs) docker logs --follow {$CONTAINER_ID}

If you want to go ahead and build several services in the same machine and you want to quickly have things running for development, you can directly use `docker-compose up` instead.
