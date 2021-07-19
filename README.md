# ace-direct

![ACE Direct](./images/adsmall.png)

This document describes how to install, configure, and deploy ACE Direct.

---

## Prerequisites and assumptions

* *Acquire domain names for the servers*. Domain names must be *three-level domain names* with *no special characters*: `acenode.domain.com`, `aceopenam.domain.com`, `acestun.domain.com`, `aceturn.domain.com`, `aceproxy.domain.com`, `acesip.domain.com`, `acekms.domain.com`, and `portal.domain.com`.
* Deploy all servers as Amazon Web Services (AWS) EC2 instances. Use the _Amazon Linux 2_ operating system, unless specified otherwise. Other Linux flavors _may_ work with slight or no changes to the instructions.
* Set all servers to the _UTC timezone_. Use `chronyd` or `ntp` to synchronize time across all servers.
* On `acenode.domain.com`, modify SE Linux: `sudo setsebool -P httpd_can_network_connect 1`. You will need to do this after any reboot.
* The only public facing server is `portal.domain.com`. All other servers only have private IP addresses on the same subnet.
* Add all server names and private IP addresses to `/etc/hosts` on all servers.
* *Create A records*. Connect your IP addresses to host names with _A records_ ([link](https://www.godaddy.com/help/add-an-a-record-19238)). Create _private A records_ for all servers. The NGINX server (`portal.domain.com`) also requires a _public A record_. Some other servers require _public A records_. See the installation instructions for those servers for more details.
* *Update provider peering lists*. For video/softphones, contact providers to update their peering lists.
* *Acquire website certificates*
  
  * Certificates should be *wildcard* certs to allow domain name flexibility.
  * Name the certificates `cert.pem` and `key.pem`.
  * Place certificates in the expected folders on all the servers: `/etc/ssl/`. Certificates must have `644` permissions.
  * For new certificates, you may need to execute `restorecon`, for example: `restorecon -R -v cert.pem`

* *Internet access*. An Internet connection is required to install, build, and update the ACE Direct software. This allows the build processes to download external software and other dependencies.

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

See [./nginx/README.md](./nginx/README.md) for installation instructions.

---

## aceopenam

The `aceopenam` server is the _identity and access management_ server, implemented with _OpenAM_. To install and configure `aceopenam`:

Log into the `aceopenam.domain.com` server and follow the instructions in [./iam/README.md](./iam/README.md) for detailed installation and configuration instructions.

---

## acesip

There are several components to install on `acesip.domain.com`:

* Clone the `asterisk` repo, and follow the installation instructions. Additionally:

  * Acquire an Asterisk certificate and copy it to `/etc/ssl/asterisk.csr` to enable the signaling server demo/test page. Then update the `common.https.csr` variable in `dat/config.json` to be `/etc/ssl/asterisk.csr`. Finally, execute: `sudo chmod 644 ~/ace-direct/dat/asterisk.csr`  . Note that the demo/test page is for development only. It is disabled by default.

* Clone the `acequill-service` repo and follow the instructions to enable captioning and language translation.

---

## aceproxy

`aceproxy` is the SIP proxy server. Log into `aceproxy.domain.com`, clone the `kamailio` repo, and follow the installation instructions.

---

## acekms

`acekms` is the Kurento media server. Log into `acekms.domain.com`, clone the `kurento` repo, and follow the installation instructions.

---

## strongSwan

Install a `strongSwan` server. See [STRONGSWAN.md](./docs/installation/STRONGSWAN.md).

---

## acenode

`acenode` hosts the Redis, MongoDB, MySQL, and application servers. Log into `acenode.domain.com` and follow the directions below.

## Prerequisites for acenode

1. An Internet connection is required during the build process.
1. Log into the `acenode` server.
1. Create/identify an ACE Direct user account, for example `/home/ec2-user`. Select the `bash` shell for the user. The user must have `sudo` capabilities.
1. Make sure Git is installed: `git --version`, otherwise, install it: `sudo yum install git -y`
1. Make sure `cc` is present: `which cc`, othwerise, install _Development Tools_: `sudo yum groupinstall "Development Tools"`
1. Copy/clone this `ace-direct` repo to the ACE Direct user home folder: `/home/ec2-user`.
1. The ACE Direct home user, e.g., `/home/ec2-user`, must have `sudo` privileges.

### Automated acenode Installation

```bash
$  cd /home/ec2-user/ace-direct
$
$  ./install_node.sh  # see the usage, then execute it with the correct parameters
```

### Manual acenode Installation

#### Setup

1. Install _Node.js_ locally:

    * Amazon Linux 2 example:

      ```bash
      $  cd /home/ec2-user  # go to the ACE Direct user home folder
      $  sudo rm -rf .nvm >/dev/null 2>&1
      $  mkdir -p .nvm
      $
      $  # install NVM
      $  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
      $
      $  . ~/.nvm/nvm.sh
      $  nvm install node
      $
      $  # if prompted, run...
      $  npm config delete prefix
      ```

    * Add the following lines to the _end_ of the  `~/.bash_profile` file:

      ```bash
      N_PREFIX=$HOME/.n
      PATH=$N_PREFIX/bin:/usr/local/bin:$PATH
      export PATH N_PREFIX
      ```

    * From a terminal, install Node `n` manager and Node.js:

      ```bash
      $  cd
      $
      $  source ~/.bash_profile
      $  rm -rf .n >/dev/null 2>&1
      $  mkdir .n
      $  npm install -g n
      $  n 12.18.2
      $  node -v  # make sure it is version 12.18.2
      $
      $  npm install -g pm2  # for process management
      $
      $  # on Windows computers...
      $  npm config set script-shell bash
      ```

#### Redis

Install and configure _Redis_. For an overview, read [Redis Quick Start](https://redis.io/topics/quickstart). Follow these instructions to install Redis on `acenode.domain.com`:

1. Download and install Redis:

    ```bash
    $  cd
    $
    $  sudo rm -rf cd redis-stable >/dev/null 2>&1
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
1. The ACE Direct database users are: `acedirect`, `asterisk`, and `media_server`.

#### Application servers

The ACE Direct application servers are Node.js servers.

> :warning: **Important**: All previous installation steps must be completed before installing the application servers.

1. Log into `acenode.domain.com`.
1. For a new ACE Direct deployment, create the initial global configuration:

    ```bash
    $  cp ~/ace-direct/dat/config.json_TEMPLATE ~/ace-direct/dat/config.json
    $
    ```

1. **Edit all values in `~/ace-direct/dat/config.json` to match your environment**. Many of the default values will work as is for a default ACE Direct installation. View `~/ace-direct/dat/parameter_desc.json` for a description of each configuration variable. Change the `<SOMEUSER>` value to your ACE Direct home user account, e.g., `ec2-user` .
1. Ensure SSH access to external libraries. This will avoid very long build times. Edit your `~/.gitconfig` file to make sure it has this entry:

    ```bash
    [url "https://"]
            insteadOf = git://
    ```

1. Build the application servers:

    ```bash
    $  cd ~/ace-direct
    $
    $  # full build
    $  npm run clean
    $  npm install
    $  npm run build
    $  npm run config
    $
    $  # other commands
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

1. Check ACE Direct system status:

    ```bash
    $  cd ~/ace-direct
    $
    $  pm2 start all  # start ACE Direct
    $  npm run status  # self-test
    ```

---

## Busylight

The BusyLight is an optional visual ring indicator that you can install on the _Agent laptop_.

See the [./obusylight/README.md](./obusylight/README.md) for instructions on how to install the BusyLight server and device on the Agent laptop.

:checkered_flag: **This completes ACE Direct installation, configuration, and deployment**.

---

## Accessing the websites

The URLs depend on your `~/ace-direct/dat/config.json` settings, specifically `nginx:ad_path`, `nginx:mp_path`, `nginx:agent_route`, and `nginx:consumer_route`.

Refer to the usernames and passwords from the `aceopenam` installation to log into the Agent and Management portals.

Default Consumer portal numbers are `111-111-1111`, `222-222-2222`, ... `999-999-9999`. However, if ITRS mode is enabled ('user_service:itrs_mode'), you will need a valid VRS phone number.

The default ACE Direct URLs are:

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

## ACE Direct troubleshooting

* Check the status of application servers on `acenode.domain.com`:

  * Run `pm2 status`:

    * Are all `status` fields `online (OK)`? If not, errors are present. View all `~/ace-direct/*/logs/*.log` files for errors.
    * Are any `restart` counts? Are they increasing? If so, errors are present.

  * To restart the application servers: `pm2 restart all`

* Perform an ACE Direct self-test:

  ```bash
  $  cd ~/ace-direct
  $
  $  npm run status  # should have all green checkmarks
  ```

* Set the `common:debug_level` parameter in `/home/acedirect/ace-direct/dat/config.json` to `ALL` to see all messages in the application server log files.
* Check the `logs` folder in each application folder for errors or warnings: `~/ace-direct/*/logs/*.log`
* Verify that all back end servers (e.g., OpenAM, Redis, MongoDB, NGINX, MySQL, Asterisk, SIP Proxy, ...) are running.
* Verify that there are _no firewalls_ blocking internal ports (e.g., `firewalld` on OpenAM would block access to port `8443`).
* Does the BusyLight device respond? Try the self-test mode on the BusyLight server app.
* Verify that the `/etc/hosts` file is configured correctly.
* Verify that the NGINX `/etc/nginx/nginx.conf` file is configured correctly.
* Verify that the global `~/ace-direct/dat/config.json` file is configured correctly.
* Management Portal installation - for any `lodash` errors, try installing the `lodash` library globally as root: `sudo npm install lodash -g`.
* NGINX cannot proxy to the NODE server - when using FQDNs for ACEDirect in `/etc/nginx/nginx.conf`, the FQDNs may force traffic through a proxy. To resolve this, map the FQDN to the private IP instead, using a private host zone. *Or*, simply use private IP addresses in place of FQDNs in `/etc/nginx/nginx.conf` for the ACEDirect, ManagementPortal, and ace (OpenAM) paths.
* No CDR records in the Management Portal - Make sure Asterisk (`acesip.domain.com`) is configured to have the MySQL database credentials, CDR database name, and CDR table name (see `~/ace-direct/dat/config.json` for database credentials). Also make sure that the _ODBC C_ library is installed on `acesip.domain.com`; this library is normally installed by the automated installation script.
* Consumer portal cannot reach Asterisk (`acesip.domain.com`); `ERR_CONNECTION_REFUSED` - make sure Asterisk is configured to use valid certificates.
* Cannot connect to portals - possibly remap the elastic IPs or try running `nslookup` on the NGINX FQDN and verify its public FQDN and public IP.
* NGINX errors when trying to connect to portals, but all servers are up and running - make sure all servers have the **correct time, synced with each other**.
* Rebooting servers - the reboot order is:

  * `aceturn` - TURN
  * `acestun` - STUN
  * `acesip` - Asterisk and ACE Quill
  * `aceproxy` - SIP proxy
  * `aceopenam` - OpenAM
  * `portal` - NGINX
  * `acekms` - media server
  * `acenode` - Node.js

    * Set SE Linux variable: `sudo setsebool -P httpd_can_network_connect 1`
    * Start Redis: `sudo service redis start`
    * Start MongoDB
    * Start MySQL
    * Start all Node.js servers: `pm2 start process.json` or `pm2 start all`

* If `acedirect-kurento` fails to build, try running `build2`:

  ```bash
  $  cd ~/ace-direct/acedirect-kurento
  $
  $  npm run clean
  $  npm run build2
  $  npm run config
  $
  $  pm2 restart all  # restart all application servers
  ```

---

_fin._
