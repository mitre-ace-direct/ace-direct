#!/bin/bash

ACE_DIRECT_HOME=""
REDIS_AUTH=""
usage() {
  printf "\nusage:  $0 [-h <ACE Direct user home folder>] [-r <REDIS auth password>]\n\n" 1>&2
  printf "  e.g.  $0 -h /home/ec2-user\n\n"
  exit 1;
}
while getopts ":h:r:" arg; do
  case "${arg}" in
    h)
      ACE_DIRECT_HOME=${OPTARG}
      ;;
    r)
      REDIS_AUTH=${OPTARG}
      ;;      
    *)
      usage
      ;;
  esac
done
shift $((OPTIND-1))

if [ -z "${ACE_DIRECT_HOME}" ] || [ -z "${REDIS_AUTH}" ]; then
  usage
fi

# install Node.js
printf "Installing Node.js...\n"
cd ${ACE_DIRECT_HOME}
sudo rm -rf .nvm >/dev/null 2>&1
mkdir -p .nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
. ~/.nvm/nvm.sh
nvm install node
npm config delete prefix

# Update environment vals
printf "Updating environment files...\n"
echo '' >> ~/.bash_profile
echo 'N_PREFIX=$HOME/.n' >> ~/.bash_profile
echo 'PATH=$N_PREFIX/bin:/usr/local/bin:$PATH' >> ~/.bash_profile
echo 'export PATH N_PREFIX' >> ~/.bash_profile
echo '' >> ~/.bash_profile

# install node
printf "Installing Node...\n"
cd ${ACE_DIRECT_HOME}
source ~/.bash_profile
rm -rf .n >/dev/null 2>&1
mkdir .n
npm install -g n
n 12.18.2
node -v  # make sure it is version 12.18.2
npm install -g pm2  # for process management
printf "\n"

# install REDIS
printf "Installing REDIS...\n"
cd ${ACE_DIRECT_HOME}
sudo rm -rf cd redis-stable >/dev/null 2>&1
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
printf "\n"

# configure REDIS
printf "Configuring REDIS...\n"
echo '' >> redis.conf
echo 'supervised systemd' >> redis.conf
echo "requirepass ${REDIS_AUTH}" >> redis.conf
echo '' >> redis.conf
sudo cp redis.conf /etc/redis/redis.conf
sudo chmod 666 /etc/redis/redis.conf
printf 'To enable REDIS logging, change the /etc/redis/redis.conf logfile value to:  "/var/log/redis.log"\n'
printf "\n"

# configure REDIS service
printf "Configuring REDIS service ...\n"
sudo rm redis.service >/dev/null 2>&1
echo '' > redis.service
echo '[Unit]' >> redis.service
echo 'Description=Redis In-Memory Data Store' >> redis.service
echo 'After=network.target' >> redis.service
echo '' >> redis.service
echo '[Service]' >> redis.service
echo 'User=root' >> redis.service
echo 'Group=root' >> redis.service
echo 'ExecStart=/usr/local/bin/redis-server /etc/redis/redis.conf' >> redis.service
echo 'ExecStop=/usr/local/bin/redis-cli shutdown' >> redis.service
echo 'Restart=always' >> redis.service
echo '' >> redis.service
echo '[Install]' >> redis.service
echo 'WantedBy=multi-user.target' >> redis.service
echo '' >> redis.service
sudo cp redis.service /etc/systemd/system/redis.service

# reload REDIS service
sudo systemctl daemon-reload
sudo systemctl enable redis.service
sudo service redis start
sudo service redis status

# install MongoDB
cd ${ACE_DIRECT_HOME}
printf "Installing MongoDB...\n"
sudo systemctl start mongod >/dev/null 2>&1
MONGO_CONF="/etc/yum.repos.d/mongodb-org-4.4.repo"
sudo chmod 666 ${MONGO_CONF}
sudo echo "" > ${MONGO_CONF}
sudo echo '[mongodb-org-4.4]' >> ${MONGO_CONF}
sudo echo 'name=MongoDB Repository' >> ${MONGO_CONF}
sudo echo 'baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/4.4/x86_64/' >> ${MONGO_CONF}
sudo echo 'gpgcheck=1' >> ${MONGO_CONF}
sudo echo 'enabled=1' >> ${MONGO_CONF}
sudo echo 'gpgkey=https://www.mongodb.org/static/pgp/server-4.4.asc' >> ${MONGO_CONF}
sudo yum install -y mongodb-org
sudo systemctl start mongod  # if it fails: sudo systemctl daemon-reload
sudo systemctl status mongod  # check status
sudo systemctl enable mongod  # start at boot time

# Install MySQL
cd ${ACE_DIRECT_HOME}
printf "Installing MySQL...\n"
sudo yum remove mysql mysql-server  > /dev/null 2>&1  # remove old version
sudo rm -rf /var/lib/mysql >/dev/null 2>&1
sudo rm -rf /etc/mysql >/dev/null 2>&1
sudo rm mysql57-community-release-el7-11.noarch.rpm* >/dev/null 2>&1
sudo yum update -y 
wget https://dev.mysql.com/get/mysql57-community-release-el7-11.noarch.rpm
sudo yum localinstall mysql57-community-release-el7-11.noarch.rpm 
sudo yum install mysql-community-server
sudo rm mysql57-community-release-el7-11.noarch.rpm* >/dev/null 2>&1

# Start MySQL
printf "Installing MySQL as a service...\n"
sudo systemctl start mysqld.service  # if it fails: sudo systemctl daemon-reload
sudo systemctl status mysqld.service  # check status
sudo systemctl enable mysqld.service  # start at boot time
  
# NEXT: populate DB tables















printf "done.\n\n"