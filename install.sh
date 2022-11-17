#!/bin/bash

# IMPORTANT
# 1. Create and fully populate ~/ace-direct/dat/config.json.
# 2. Execute this script

OLDIFS=$IFS
RS='\u001b[0m'
FG_RED='\u001b[31m'
OK_ICON='✅'
NOTOK_ICON='❌'
Q='🤔'
CONFIG_FILE=${HOME}/ace-direct/dat/config.json

# intro message
printf "\n"
printf "****************************************\n"
printf "*  ACE Direct acenode installation     *\n"
printf "****************************************\n"
printf "\n"
printf "This script will install ACE Direct in user account ${USER}.\n"
printf "\n"
printf "IMPORTANT: Create and populate the ~/ace-direct/dat/config.json file before executing this installation script.\n"
printf "\n"
read -p "${Q} OK to continue (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
  printf ""
else
  printf "Aborting installation...\n\n"
  exit 1
fi

printf "\nchecking requirements...\n\n"

# check ace-direct repo folder location
if cd ~/ace-direct >/dev/null 2>&1
then
  printf "${OK_ICON} found ~/ace-direct folder\n"
else
  printf "${NOTOK_ICON} ${CONFIG_FILE} error - ace-direct folder must be in the home folder: ~/ace-direct\n"
  exit 1
fi

# check for config.json
cd ~/ace-direct
if [ ! -f ${CONFIG_FILE} ]; then
  printf "${NOTOK_ICON} ${CONFIG_FILE} does not exist. Please create it.\n"
  exit 1
else
  printf "${OK_ICON} found ${CONFIG_FILE}\n"
fi

# check for sudo permissions
if sudo ls >/dev/null 2>&1
then
  printf "${OK_ICON} sudo permissions good\n"
else
  printf "${NOTOK_ICON} error - user does not have sudo permissions! exiting...\n"
  exit 99
fi

# check certs
KEY_PEM=`python scripts/parseSingleJson.py dat/config.json common:https:private_key`
CERT_PEM=`python scripts/parseSingleJson.py dat/config.json common:https:certificate`

if [ ! -f ${KEY_PEM} ]; then
  printf "${NOTOK_ICON} error - cert file is missing: ${KEY_PEM}.\n\n"
  exit 99
fi
if [ ! -f ${CERT_PEM} ]; then
  printf "${NOTOK_ICON} error - cert file is missing: ${CERT_PEM}.\n\n"
  exit 99
fi

if openssl x509 -checkend 86400 -noout -in ${CERT_PEM} >/dev/null 2>&1
then
  printf "${OK_ICON} ${CERT_PEM} is good\n"
else
  printf "${NOTOK_ICON} error - ${CERT_PEM} has expired or will expire in 24 hours, please acquire new certs\n\n"
  read -p "${Q} Continue anyway (y/n)? " -n 1 -r
  printf "\n"
  if [[ $REPLY =~ ^[Yy]$ ]]
  then
    printf "\n"
  else
    printf "Aborting installation...\n\n"
    exit 1
  fi
fi

# check for Git
if git --version >/dev/null 2>&1
then
  printf "${OK_ICON} found git\n"
else
  printf "No git, installing it now...\n"
  sudo yum install git -y
fi
# create .gitconfig file
echo '[url "https://"]' > ~/.gitconfig
echo '    insteadOf = git://' >> ~/.gitconfig

# check for cc
if which cc >/dev/null 2>&1
then
  printf "${OK_ICON} found cc\n"
else
  printf "No cc, installing now...\n"
  sudo yum -y groupinstall "Development Tools"
fi
printf "\n"

### BEGIN INSTALLATION ###

# install MySQL and create databases
read -p "${Q} Install MariaDB (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
  sudo systemctl stop mariadb >/dev/null 2>&1
  sudo yum list installed | grep maria | awk 'NR>2' | cut -d' ' -f1 | xargs sudo yum remove -y
  sudo rm -rf /var/lib/mysql  >/dev/null 2>&1
  sudo rm /etc/my.cnf >/dev/null 2>&1
  sudo rm ~/.my.cnf >/dev/null 2>&1
  sudo yum update -y
  sudo yum install -y mariadb-server
  sudo systemctl start mariadb
  sudo systemctl enable mariadb
  sudo mysql_secure_installation 
fi

# create databases
printf "\n"
read -p "${Q} Create databases (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
  cd ~/ace-direct
  EXTENSION_PASSWORD=`python scripts/parseSingleJson.py dat/config.json asterisk:extensions:secret`
  ACEDIRECT_USER=`python scripts/parseSingleJson.py dat/config.json database_servers:mysql:user`
  ASTERISK_USER="asterisk"
  ACEDIRECT_PASSWORD=`python scripts/parseSingleJson.py dat/config.json database_servers:mysql:password`
  ASTERISK_PASSWORD=`python scripts/parseSingleJson.py dat/config.json database_servers:mysql:password`
  ACEDIRECT_DB=`python scripts/parseSingleJson.py dat/config.json database_servers:mysql:ad_database_name`
  ASTERISK_DB=`python scripts/parseSingleJson.py dat/config.json database_servers:mysql:cdr_database_name`
  MEDIA_DB=`python scripts/parseSingleJson.py dat/config.json database_servers:mysql:ssdatabase`
  CDR_TABLE=`python scripts/parseSingleJson.py dat/config.json database_servers:mysql:cdr_table_name`

  cd ~/ace-direct/dat

  TMP_FILE3=/tmp/sql_123_456.sql
  cat acedirectdefault_maria.sql | sed -e "s/_EXTENSION_PASSWORD_/${EXTENSION_PASSWORD}/g" | sed -e "s/_ACEDIRECT_USER_/${ACEDIRECT_USER}/g" | sed -e "s/_ASTERISK_USER_/${ASTERISK_USER}/g" | sed -e "s/_ACEDIRECT_PASSWORD_/${ACEDIRECT_PASSWORD}/g" | sed -e "s/_ASTERISK_PASSWORD_/${ASTERISK_PASSWORD}/g" | sed -e "s/_ACEDIRECT_DB_/${ACEDIRECT_DB}/g" | sed -e "s/_ASTERISK_DB_/${ASTERISK_DB}/g" | sed -e "s/_MEDIA_DB_/${MEDIA_DB}/g" | sed -e "s/_CDR_TABLE_/${CDR_TABLE}/g" >  $TMP_FILE3

  echo "Running SQL script (root)..."
  mysql -u root -p -h localhost < $TMP_FILE3
  rm -f $TMP_FILE3 >/dev/null 2>&1
  cd ~
fi

# install Node
NODE_VER='v16.15.1'
printf "\n"
read -p "${Q} Install Node.js (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
  read -p "${Q} Node.js version [${NODE_VER}]: " -r
  VAL=`echo ${REPLY} | sed 's/ *$//g'`
  if [ ! -z "$VAL" ]; then
    NODE_VER=$VAL
  fi
  cd ~
  rm -rf .nvm >/dev/null 2>&1
 
  # this line may need updating in the future
  curl -o- -k https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

  source ~/.bashrc

  nvm install ${NODE_VER}
  nvm use ${NODE_VER}
  nvm use --delete-prefix ${NODE_VER}
  nvm alias default ${NODE_VER}

  npm install -g pm2
  which node
  which pm2  # should point to home folder
fi

# install REDIS
TMP_FILE1=/tmp/inst.123.456
sudo rm -f $TMP_FILE1 >/dev/null 2>&1
cat > $TMP_FILE1 <<- EndOfMessage
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
EndOfMessage

printf "\n"
read -p "${Q} Install REDIS (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
  cd ~
  sudo service redis stop >/dev/null 2>&1
  sudo rm -rf redis-stable >/dev/null 2>&1
  sudo rm -f redis-stable.tar.gz >/dev/null 2>&1
  sudo rm -f /etc/redis/redis.conf
  wget http://download.redis.io/redis-stable.tar.gz
  tar xvzf redis-stable.tar.gz
  cd redis-stable
  sudo make distclean
  sudo make
  sudo make install
  ls /usr/local/bin/redis-server /usr/local/bin/redis-cli  # both folders should exist
  sudo yum install -y tcl
  sudo mkdir -p /var/lib/redis
  sudo mkdir -p /etc/redis
  sudo cp redis.conf /etc/redis/redis.conf  
  sudo chmod 666 /etc/redis/redis.conf
  sudo rm -rf redis-stable >/dev/null 2>&1
  sudo rm -f redis-stable.tar.gz >/dev/null 2>&1

  cd ~/ace-direct
  REDIS_PASSWORD=`python scripts/parseSingleJson.py dat/config.json database_servers:redis:auth`
  cd ~
  sudo echo 'supervised systemd' >> /etc/redis/redis.conf
  sudo echo 'logfile "/var/log/redis.log"' >> /etc/redis/redis.conf
  sudo echo "requirepass ${REDIS_PASSWORD}" >> /etc/redis/redis.conf

  sudo bash -c "cat ${TMP_FILE1} > /etc/systemd/system/redis.service"
  sudo rm -f $TMP_FILE1 >/dev/null 2>&1

  sudo systemctl daemon-reload
  sudo systemctl enable redis.service
  sudo service redis start
fi

# install MongoDB
TMP_FILE2=/tmp/inst.456.123
sudo rm -f $TMP_FILE2 >/dev/null 2>&1
cat > $TMP_FILE2 <<- EndOfMessage
[mongodb-org-4.4]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/4.4/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-4.4.asc
EndOfMessage

printf "\n"
read -p "${Q} Install MongoDB (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
  sudo service mongod stop >/dev/null 2>&1
  sudo systemctl stop mongod >/dev/null 2>&1
  sudo yum list installed | grep mongo  | awk 'NR>2' | cut -d' ' -f1 | xargs sudo yum remove -y
  sudo bash -c "cat ${TMP_FILE2} > /etc/yum.repos.d/mongodb-org-4.4.repo"
  sudo rm -f $TMP_FILE1 >/dev/null 2>&1
  sudo yum install -y mongodb-org
  sudo systemctl start mongod  # if it fails: sudo systemctl daemon-reload
  sudo systemctl enable mongod  # start at boot time
fi

# build Node
printf "\n"
read -p "${Q} Build Node servers (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
  cd ~/ace-direct
  pm2 stop all >/dev/null 2>&1
  pm2 delete all >/dev/null 2>&1
  npm run clean
  npm run build
  npm run config
  printf "Starting node servers...\n"
  pm2 start dat/process.json
fi

echo "done."
