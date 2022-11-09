# ace-direct

![ACE Direct](./images/adsmall.png)

This document describes how to install, configure, and deploy ACE Direct.

---

## Prerequisites and assumptions

* The acedirect-kurento signaling server has been tested with JsSIP library version `3.5.1`. All interoperability tests have been completed with this version. **IMPORTANT**: ACE Direct is tied to JsSIP `3.5.1`. To upgrade the JsSIP library version, the files in `jssip-modifications` must be ported/developed.
* _Acquire[] domain names for the servers_. Domain names must be _three-level domain names_ with _no special characters_, for example: `acenode.domain.com`, `acestun.domain.com`, `aceturn.domain.com`, `aceproxy.domain.com`, `acesip.domain.com`, `acekms.domain.com`, and `portal.domain.com`.
* Deploy all servers as Amazon Web Services (AWS) EC2 instances. Use the _Amazon Linux 2_ operating system, unless specified otherwise. Other Linux flavors _may_ work with slight or no changes to the instructions.
* Set all servers to the _UTC timezone_. Use `chronyd` or `ntp` to synchronize time across all servers.
* On `acenode.domain.com`, modify SE Linux: `sudo setsebool -P httpd_can_network_connect 1`. You will need to do this after any reboot.
* The only public facing server is `portal.domain.com`. All other servers only have private IP addresses on the same subnet.
* Add all server names and private IP addresses to `/etc/hosts` on all servers.
* _Create A records_. Connect your IP addresses to host names with _A records_ ([link](https://www.godaddy.com/help/add-an-a-record-19238)). Create _private A records_ for all servers. The NGINX server (`portal.domain.com`) also requires a _public A record_. Some other servers require _public A records_. See the installation instructions for those servers for more details.
* _Update provider peering lists_. For video/softphones, contact providers to update their peering lists.
* _Acquire website certificates_
  
  * Certificates should be _wildcard_ certs to allow domain name flexibility.
  * Name the certificates `cert.pem` and `key.pem`.
  * Place certificates in the expected folders on all the servers: `/etc/ssl/`. Certificates must have `644` permissions.
  * For _new_ certificates, you may need to execute `restorecon`, for example: `restorecon -R -v cert.pem`

* _Internet access_. An Internet connection is required to install, build, and update the ACE Direct software. This allows the build processes to download external software and other dependencies.

---

## acestun

Install the STUN server on `acestun.domain.com`. See [./docs/installation/STUN.md](./docs/installation/STUN.md).

---

## aceturn

Install the TURN server on `aceturn.domain.com`. See [./docs/installation/TURN.md](./docs/installation/TURN.md).

---

## portal

This is the NGINX server for ACE Direct. The server acts as a _reverse proxy_, hiding internal Node.js servers from public access.

Install NGINX on `portal.domain.com`.

See [./nginx/README.md](./nginx/README.md) for installation instructions. There is an installation script there.

---

## acesip

There are several components to install on `acesip.domain.com`:

* Clone the `asterisk` repo, and follow the installation instructions. Additionally:

  * Acquire an Asterisk certificate and copy it to `/etc/ssl/asterisk.csr` to enable the signaling server demo/test page. Then update the `common.https.csr` variable in `dat/config.json` to be `/etc/ssl/asterisk.csr`. Finally, execute: `sudo chmod 644 ~/ace-direct/dat/asterisk.csr`  . Note that the demo/test page is for development only. It is disabled by default.

* To enable ITRS lookups in ACE Direct:

  * Copy the `asterisk/scripts/itrslookup.sh` from the `asterisk` repo to `ace-direct/scripts/itrslookup.sh` in this repo.
  * Configure the `itrslookup.sh` script for the desired providers.
  * ITRS lookups are disabled by default in the ACE Direct consumer portal.

* Clone the `acequill-service` repo and follow the instructions to enable captioning and language translation.

---

## aceproxy

`aceproxy` is the SIP proxy server. Log into `aceproxy.domain.com`, clone the `kamailio` repo, and follow the installation instructions.

---

## acekms

`acekms` is the Kurento media server. Log into `acekms.domain.com`, clone the `kurento` repo, and follow the installation instructions.

Copy the `kms-share` folder from this repo to `acekms` and follow the [README.md](kms-share/README.md) to install it.

---

## strongSwan

Install a `strongSwan` server. See [STRONGSWAN.md](./docs/installation/STRONGSWAN.md).

---

## acenode

`acenode` hosts the Redis, MongoDB, MySQL, and Node.js application servers. Log into `acenode.domain.com` and follow the directions below.

### Automatic installer for acenode

> :warning: **This installer assumes that you already installed:**: Asterisk, NGINX, STUN, TURN, Kurento, and Kamailio.

For convenience, the automatic installer installs all the core components on `acenode`. The recommended instance size for `acenode` is `t3a.medium`. `acenode` should **not** have a public FQDN.

The automatic installer script is [install.sh](install.sh). This script will perform the following on `acenode`:

* Install prerequisites
* Install Redis, MongoDB, MySQL, and Node.js app servers
* Populate databases
* Deploy ACE Direct
* Perform status checks

To use the script:

```bash
$  # clone this repo to the ACE Direct user account (e.g., /home/ec2-user) on the acenode server
$
$  cd /home/ec2-user/ace-direct
$  ./install.sh  # see the usage, then run with the required parameters
.
.
.
```

For example...

```bash
$  ./install.sh -u ec2-user \
     -s acestun.domain.com \
     -t aceturn.domain.com \
     -m "acenode.domain.com 1.0.0.1" \
     -n "portal.domain.com 1.0.0.1" \
     -k "acekms.domain.com  1.0.0.2" \
     -a "acesip.domain.com  1.0.0.3" \
     -c /etc/ssl/cert.pem \
     -y /etc/ssl/key.pem
```

After executing this script, try to access the portals. See [Accessing the websites](#accessing-the-websites) .

For manual installation and customization of your ACE Direct deployment, continue to [Manual installation of acenode](#manual-installation-of-acenode).

### Manual installation of acenode

Here are detailed installation instructions, if you do not use the overall installer above.

#### Prerequisites for acenode

Complete these prerequisite prior to installation:

1. An Internet connection is required during the build process.
1. Log into the `acenode` server.
1. Create/identify an ACE Direct user account, for example `/home/ec2-user`. Select the `bash` shell for the user.
1. Install in the home folder `/home/ec2-user`.
1. Make sure Git is installed: `git --version`, otherwise, install it: `sudo yum install git -y`
1. Make sure `cc` is present: `which cc`, othwerise, install _Development Tools_: `sudo yum groupinstall "Development Tools"`
1. Copy/clone this `ace-direct` repo to the ACE Direct user home folder: `/home/ec2-user`.
1. Make sure that the ACE Direct home user, e.g., `/home/ec2-user`, has `sudo` privileges.

#### Setup

1. Install _Node.js_ locally:

    * Amazon Linux 2 example:

      ```bash
      $  cd /home/ec2-user  # go to the ACE Direct user home folder
      $  rm -rf .nvm >/dev/null 2>&1
      $
      $  # Install NVM: get recent curl command from https://nvm.sh - Installing and Updating
      $  curl -o- -k https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
      $
      $  # CLOSE and REOPEN your termninal !!!
      $
      $  nvm install v16.15.1  # install preferred Node version
      $  nvm use v16.15.1  # use the version
      $  nvm use --delete-prefix v16.15.1  # if prompted
      $  nvm alias default v16.15.1  # set the default version  
      $
      $  npm install -g pm2
      $
      $  which node ; which pm2  # should point to home folder
      $
      ```

#### Redis

Install and configure _Redis_. For an overview, read [Redis Quick Start](https://redis.io/topics/quickstart). Follow these instructions to install Redis on `acenode.domain.com`:

1. Download and install Redis:

    ```bash
    $  cd
    $
    $  sudo rm -rf redis-stable >/dev/null 2>&1
    $  wget http://download.redis.io/redis-stable.tar.gz
    $  tar xvzf redis-stable.tar.gz
    $  cd redis-stable
    $  sudo make distclean
    $  sudo make
    $  sudo make install
    $  ls /usr/local/bin/redis-server /usr/local/bin/redis-cli  # both folders should exist
    $  sudo yum install -y tcl
    $
    $  sudo mkdir -p /var/lib/redis
    $  sudo mkdir -p /etc/redis
    $  sudo cp redis.conf /etc/redis/redis.conf  
    $  sudo chmod 666 /etc/redis/redis.conf
    ```

1. Configure Redis by editing `/etc/redis/redis.conf`. Enable and set the fields below, selecting your own value for the secret Redis password: `myRedisPassword`:

    ```bash
    supervised systemd
    logfile "/var/log/redis.log"
    requirepass myRedisPassword
    ```

1. Enable Redis as a service by creating `/etc/systemd/system/redis.service`:

    ```bash
    [Unit]
    Description=Redis In-Memory Data Store
    After=network.target

    [Service]
    User=root
    Group=root
    ExecStart=/usr/local/bin/redis-server /etc/redis/redis.conf
    ExecStop=/usr/local/bin/redis-cli shutdown
    Restart=always

    [Install]
    WantedBy=multi-user.target
    ```

1. Reload the Redis service and make it start on reboot:

    ```bash
    $  sudo systemctl daemon-reload
    $
    $  sudo systemctl enable redis.service
    ```

1. Managing the Redis service:

    ```bash
    $  sudo service redis start
    $
    $  sudo service redis status
    $  sudo service redis stop
    ```

#### MongoDB

ACE Direct uses a _MongoDB_ database for call statistics. Follow the instructions below to install ACE Direct on `acenode.domain.com`.

1. Create a `/etc/yum.repos.d/mongodb-org-4.4.repo` file with the following contents:

    ```bash
    [mongodb-org-4.4]
    name=MongoDB Repository
    baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/4.4/x86_64/
    gpgcheck=1
    enabled=1
    gpgkey=https://www.mongodb.org/static/pgp/server-4.4.asc
    ```

1. Install MongoDB and make it start on reboot:

    ```bash
    $  sudo yum install -y mongodb-org
    $
    $  sudo systemctl start mongod  # if it fails: sudo systemctl daemon-reload
    $  sudo systemctl status mongod  # check status
    $  sudo systemctl enable mongod  # start at boot time
    $
    $  sudo systemctl stop mongod  # in case you need to stop MongoDB
    ```

1. MongoDB uses port `27017` by default.

#### MySQL

ACE Direct uses a MySQL database for application data. Install MySQL locally on `acenode.domain.com` _or_ deploy an Amazon AWS RDS service.

The instructions below describe how to install MySQL locally on `acenode.domain.com`.

1. Install MySQL Server Version `5.6.37` or a similar version and note the database root user and password:

    ```bash
    $  sudo yum remove mysql mysql-server  > /dev/null 2>&1  # remove old version
    $
    $  sudo rm -rf /var/lib/mysql >/dev/null 2>&1
    $  sudo rm -rf /etc/mysql >/dev/null 2>&1
    $  sudo rm mysql57-community-release-el7-11.noarch.rpm* >/dev/null 2>&1
    $  sudo yum update -y 
    $  wget https://dev.mysql.com/get/mysql57-community-release-el7-11.noarch.rpm
    $  sudo yum localinstall mysql57-community-release-el7-11.noarch.rpm 
    $  sudo yum install mysql-community-server
    $  sudo rm mysql57-community-release-el7-11.noarch.rpm* >/dev/null 2>&1
    ```

1. Enable MySQL as a service and start it on reboot:

    ```bash
    $
    $  sudo systemctl start mysqld.service  # if it fails: sudo systemctl daemon-reload
    $  sudo systemctl status mysqld.service  # check status
    $  sudo systemctl enable mysqld.service  # start at boot time
    $
    $  sudo systemctl stop mysqld.service  # in case you need to stop MySQL
    ```

1. With MySQL started secure the installation::

    ```bash
    $  # get the temporary root password
    $  sudo grep 'temporary password' /var/log/mysqld.log  # get the temporary root password
    $
    $  mysql_secure_installation  # reset the root password (REMEMBER IT!); configure security options
    $  
    ```

1. On `acenode.domain.com`, modify the `~/ace-direct/dat/acedirectdefault.sql` script:

   * Globally replace `_EXTENSION_PASSWORD_` with the _actual extension password_ from Asterisk. See the `password=` field in `/etc/asterisk/pjsip.conf` on `acesip.domain.com`.
   * Change `_ACEDIRECT_PASSWORD_` to the desired password for the `acedirect` database user.
   * Change `_ASTERISK_PASSWORD_` to the desired password for the `asterisk` database user.

1. Execute the `~/ace-direct/dat/acedirectdefault.sql` script to create the ACE Direct databases and user accounts. You will need your MySQL `root` user and password. Here is an example, assuming a root user `root`:

    ```bash
    $  mysql -u root -p -h localhost < acedirectdefault.sql  # you will be prompted for the password
    $
    ```

1. MySQL uses port `3306` by default.
1. The ACE Direct database users are: `acedirect` and `asterisk`.

#### Application servers

##### Configure application servers

The ACE Direct application servers are Node.js servers.

> :warning: **Important**: All previous installation steps must be completed before installing the application servers.

1. Log into `acenode.domain.com`.
1. For a new ACE Direct deployment, create the initial global configuration:

    ```bash
    $  cp ~/ace-direct/dat/config.json_TEMPLATE ~/ace-direct/dat/config.json
    $
    ```

1. **Edit all values in the  `~/ace-direct/dat/config.json` global configuration file to match your environment**.

    * Review all lines in the file and make necessary edits.
    * Many of the default values will work as-is for a default ACE Direct installation. The installation scripts in this repo assume default values.
    * View `~/ace-direct/dat/parameter_desc.json` for a description of each configuration variable.
    * Supply FQDNs, IP addresses, etc. for the ACE Direct components that were installed in the previous steps.

1. Ensure SSH access to external libraries. This will avoid very long build times. Edit your `~/.gitconfig` file to make sure it has this entry:

    ```bash
    [url "https://"]
            insteadOf = git://
    ```

1. Create initial `fognito` users. See [fognito/README.md](fognito/README.md). Use the same agent and manager usernames found in [dat/acedirectdefault.sql](dat/acedirectdefault.sql) when creating `fognito/db/data/users.csv`.

##### Build and deploy application servers

1. Build the application servers:

    ```bash
    $  cd ~/ace-direct
    $
    $  # full build
    $  npm run clean
    $  npm run build
    $  npm run config  # only needed once
    $
    $  # other useful commands
    $  npm run test  # automated tests, make sure all Node servers are down
    $  npm run lint  # run linting tests
    $  npm run clean  # remove all external libs
    $  npm run clean:logs  # remove log files
    ```

1. Deploy the application servers - ACE Direct services use [pm2](https://pm2.keymetrics.io/) for process management:

    ```bash
    $  cd ~/ace-direct
    $
    $  # starting
    $  pm2 start dat/process.json   # first time or clean build
    $  pm2 status  # check status of app servers
    $
    $  # other commands
    $
    $  pm2 start all  # ongoing
    $  pm2 restart all  # ongoing
    $  pm2 restart 0  # restart just ID 0, for example
    $
    $  # stopping
    $  pm2 stop all
    $  pm2 stop 0  # stop one, ACE Direct server
    $
    $  # reset counters
    $  pm2 reset all  # reset all
    $  pm2 reset 0  # reset just ID 0
    $
    $  # deleting services
    $  pm2 stop all
    $  pm2 delete all
    ```

1. Make app servers start on reboot:

    ```bash
    $  cd  ~/ace-direct
    $
    $  pm2 start dat/process.json  # start all node servers
    $  pm2 save
    $  pm2 startup
    $  # now node.js servers will start on boot
    ```

1. Check ACE Direct system status (requires `ssh` access from `acenode.domain.com` to the other servers):

    ```bash
    $  cd ~/ace-direct
    $
    $  pm2 start all  # start ACE Direct
    $  npm run status  # self-test; requires ssh between internal servers
    ```

1. Another way to build and deploy the application servers the script:

    ```bash
    $  cd ~/ace-direct
    $
    $  scripts/build.sh  # build and deploy
    ```

---

## Busylight

The BusyLight is an optional visual ring indicator that you can install on the _Agent laptop_.

See the [./obusylight/README.md](./obusylight/README.md) for instructions on how to install the BusyLight server and device on the Agent laptop.

:checkered_flag: **This completes ACE Direct installation, configuration, and deployment**.

---

## Enterprise Service Bus

The enterprise service bus (esb) is an optional component. Use it to integrate with your existing CRM systems. See the [esb/README.md](esb/README.md) file for more information.

---

:checkered_flag: **This completes ACE Direct installation, configuration, and deployment**.

## Creating initial users

Create agent and manager users: [fognito/README.md#creating-initial-users](fognito/README.md#creating-initial-users)

## Accessing the websites

The URLs depend on your `~/ace-direct/dat/config.json` settings, specifically `nginx:fognito_path`, `nginx:ad_path`, `nginx:mp_path`, `nginx:agent_route`, and `nginx:consumer_route`.

Default Consumer portal numbers are `111-111-1111`, `222-222-2222`, ... `999-999-9999`. However, if ITRS mode is enabled ('user_service:itrs_mode'), you will need a valid VRS phone number.

The default ACE Direct URLs are:

* Universal login: `https://portal.domain.com/ace`
* Agent portal: `https://portal.domain.com/ACEDirect/agent`
* Consumer portal: `https://portal.domain.com/ACEDirect/call`
* Management portal: `https://portal.domain.com/ManagementPortal`

---

## Documentation

See the [docs](docs/) folder for the official ACE Direct user guide, installation manual, and other useful documentation.

---

## Release Notes

See the [RELEASE](RELEASE.md) notes for ACE Direct version information.

---

## ACE Direct Troubleshooting and Configuration Tips

1. Check the status of application servers on `acenode.domain.com`:

* Run `pm2 status`:

  * Are all `status` fields `online (OK)`? If not, errors are present. View all `~/ace-direct/*/logs/*.log` files for errors.
  * Are any `restart` counts? Are they increasing? If so, errors are present.

1. To restart the application servers: `pm2 restart all`
1. Perform an ACE Direct self-test on the `acenode` server (requires `ssh` access to all servers):

  ```bash
  $  cd ~/ace-direct
  $
  $  npm run status  # should have all green checkmarks
  ```

1. Set the logging level. Change the `common:debug_level` parameter in `~/ace-direct/dat/config.json` to `ALL` to see all messages in the application server log files. Run `pm2 restart all` to enable the new log level.

1. Check the `logs` folder in each application folder for errors or warnings: `~/ace-direct/*/logs/*.log` .
1. Verify that all back-end servers (e.g., Redis, MongoDB, NGINX, MySQL, Asterisk, SIP Proxy, Kurento, ...) are running.
1. Verify that there are _no firewalls_ blocking internal ports (e.g., `firewalld` on `acenode.domain.com` could block access to some internal ports).
1. Does the BusyLight device respond? Try the self-test mode on the BusyLight server app.
1. Verify that the `/etc/hosts` file is configured correctly on all back-end servers.
1. Verify that the NGINX `/etc/nginx/nginx.conf` file is configured correctly.
1. Verify that the global `~/ace-direct/dat/config.json` file is configured correctly. This must be configured _before_ building the application.
1. When rebooting servers, the order is:

* `aceturn` - TURN
* `acestun` - STUN
* `acesip` - Asterisk and ACE Quill
* `aceproxy` - SIP proxy
* `portal` - NGINX
* `acekms` - media server
* `acenode` - Node.js

  * Set SE Linux variable: `sudo setsebool -P httpd_can_network_connect 1`
  * Start Redis: `sudo service redis start`
  * Start MongoDB
  * Start MySQL
  * Start all Node.js servers: `pm2 start ~/ace-direct/dat/process.json` or `pm2 start all`

1. To use a custom videomail intro video for Consumer videomail, put the video in `acedirect/public/media/` . Set the filename in `dat/config.json`: `web_videomail.introVideo` .
1. To use custom Consumer portal intro videos, put them in `acedirect/public/media` and update the `complaint_videos` section in `dat/config.json`.

---

## ACE Direct Issues and Solutions

1. **ISSUE**: Management portal build has `lodash` errors. **SOLUTION**: Installing the `lodash` library globally as root: `sudo npm install lodash -g` and rebuild.
1. **ISSUE**: NGINX cannot proxy to the `acenode` server. **SOLUTION**: When using FQDNs for ACE Direct in `/etc/nginx/nginx.conf`, the FQDNs may force traffic through a proxy. To resolve this, map the FQDN to the private IP instead, using a private host zone. _Or_, simply use private IP addresses in place of FQDNs in `/etc/nginx/nginx.conf` for all the paths.
1. **ISSUE**: There are no CDR records in the management portal. **SOLUTION**: Make sure Asterisk (`acesip.domain.com`) is configured to have the MySQL database credentials, CDR database name, and CDR table name (see `~/ace-direct/dat/config.json` for these values). On `acesip.domain.com`, check the `/etc/odbc.ini` and `/etc/asterisk/*odbc.conf` files. Make sure that the _ODBC C_ library is installed on `acesip.domain.com`.
1. **ISSUE**: The consumer portal cannot reach Asterisk (`acesip.domain.com`); `ERR_CONNECTION_REFUSED`. **SOLUTION**: Make sure Asterisk is configured to use valid certificates.
1. **ISSUE**: Server certificates may have expired. **SOLUTION**: Check certificate expiration: `openssl x509 -enddate -noout -in cert.pem`
1. **ISSUE**: Cannot connect to the agent, consumer, or management portals from a browser. **SOLUTION**: Remap the AWS elastic IPs. Run `nslookup` on the NGINX FQDN and verify its public FQDN and public IP.
1. **ISSUE**: NGINX errors occur when trying to connect to the portals, but all servers are up and running. **SOLUTION**: Make sure all servers have the correct time, synced with each other.
1. **ISSUE**: `acedirect-kurento` fails to build. **SOLUTION**:

    ```bash
    $  cd ~/ace-direct/acedirect-kurento
    $
    $  npm run clean
    $  npm run build2
    $  npm run config
    $
    $  pm2 restart all  # restart all application servers
    ```

1. **ISSUE**: `acedirect-kurento` takes _too long_ to build. **SOLUTION**:

    ```bash
    $  cd ~/ace-direct/acedirect-kurento/vendor/reconnect-ws
    $
    $  rm package-lock.json
    $  npm run clean
    $  npm run build
    $
    $  cd ~/ace-direct/acedirect-kurento
    $  npm run clean
    $  npm run build
    $
    ```

1. **ISSUE**: The Node builds on `acenode` are taking _too long_. **SOLUTION**: See the instructions above for creating the `~/.gitconfig` file.
1. **ISSUE**: A specific node server is failing to build or start. **SOLUTION**: The `package-lock.json` file may be outdated. Delete the file and rebuild. For example, for `videomail-service`:

    ```bash
    $  cd ~/ace-direct/videomail-service
    $
    $  rm package-lock.json
    $  npm run build
    $  pm2 restart all  # restart the node servers
    $
    ```

1. **ISSUE**: The Node server builds on `acenode` are failing. **SOLUTION**: Verify the `npm` version and update it if necessary:

    ```bash
    $  npm -v
    7.19.1
    $
    $  # to update to 7.19.1 (for example):
    $  npm install -g npm@7.19.1
    $
    ```

1. **ISSUE**: All Node services appear to be working, but calls are not queuing. **SOLUTION**: The signaling server (`acedirect-kurento`) may have trouble connecting to Asterisk. There may be reconnect messages in the signaling server log file. Asterisk may have a successful status, but it could be unresponsive. Try restarting the Asterisk service: `sudo service asterisk restart`.
1. **ISSUE**: On an incoming consumer portal call, the agent portal sees the consumer extension instead of the VRS number as the caller ID number. Also, the agent has no incoming video after answering the call. **SOLUTION**: Try restarting REDIS: `sudo service redis restart`. Also make sure the agent URL environment matches the consumer portal URL environment.
1. **ISSUE**: This message appears: [agent] _has an account but ACE Direct Agent extensions have not yet been configured by a Manager_. **SOLUTION**: Make sure the MySQL `agent_table` has been updated for `v6.1`: `ALTER TABLE agent_data ADD profile_picture varchar(50);`.
1. **ISSUE**: Node servers have this MySQL error: `ER_NOT_SUPPORTED_AUTH_MODE: Client does not support authentication protocol requested by server; consider upgrading MySQL client`. **SOLUTION**: Grant full privileges to the primary database user has on all databases, for example:

    ```bash
    GRANT ALL PRIVILEGES ON acedirect.* TO 'acedirect'@'%';
    GRANT ALL PRIVILEGES ON media_server.* TO 'acedirect'@'%';
    GRANT SELECT ON asterisk.* to 'acedirect'@'%';
    ```

1. **ISSUE**: Database queries are failing in MySQL8. **SOLUTION**: Disable strict mode: `USE acedirect; SET GLOBAL sql_mode='';`. Note, when strict mode is on, [fognito/db/create-user.sh](fognito/db/create-user.sh) may fail to add MySQL users.
1. **ISSUE**: When the agent logs in, an error appears in the agent portal browser console: `WebSocket connection to 'wss://...' failed:`. **SOLUTION**: Make sure the `common.https.csr` file specified in `dat/config.json` actually exists on the Node server. It can be an empty file. It is created in the dat folder by the build process.
1. **ISSUE**: Some incoming VRS provider calls get into queue, but some don't. **SOLUTION**: Make sure the SIP Proxy server database has the appropriate IP entries for each provider.
1. **ISSUE**: Consumer web calls are not queueing. The acedirect-kurento error log shows a silent error: `'media_server.ace_direct_webrtc_session' doesn't exist`. **SOLUTION**: Run `cd ~/ace-direct; npm run config` to create the media_server tables at the start of a deployment. Restart node `pm2 restart all` and try again.
1. **ISSUE**: Agents do not appear in the management portal. SOLUTIN: Make sure the `/etc/asterisk/agents.conf` file has the correct agent names and extensions.
1. **ISSUE**: Inbound VRS calls are not connecting. There is no IVVR shown. The call just disconnects. **SOLUTION**: Make sure the call center is open. Use the management portal to _open_ the call center.
1. **ISSUE**: Inbound web calls are connecting, but there is no incoming video on either side. **SOLUTION**: Make sure the STUN and TURN servers are running. Make sure the STUN and TURN servers are properly configured in `~/ace-direct/dat/config.json`.
1. **ISSUE**: Node builds fail with `MODULE_NOT_FOUND` errors on `ProcessContainerFork.js` and `loader.js`. **SOLUTION**: The Node.js installation and library locations may have changed. Run `pm2 stop all; pm2 delete all; pm2 save; cd ~/ace-direct ; pm2 start dat/process.json; pm2 save`

---

_fin._
