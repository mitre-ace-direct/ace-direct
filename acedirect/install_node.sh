#!/bin/bash

RS='\u001b[0m'
FG_RED='\u001b[31m'
OK_ICON='✅'
NOTOK_ICON='❌'
Q='🤔 '

ACE_DIRECT_HOME=""
REDIS_AUTH=""
RDPASS1=""
RDPASS2=""
ADPASS1=""
ADPASS2=""
ASPASS1=""
ASPASS2=""
EXPASS1=""
EXPASS2=""

usage() {
  printf "\nusage:  $0 -h <ACE Direct user home folder> [-r <REDIS auth password>] [-p <ACE Direct MySQL password>] [-a <Asterisk MySQL password>] [-e <Asterisk extensions password>]\n\n" 1>&2
  printf "  e.g.  $0 -h /home/ec2-user\n\n"
  exit 1;
}
while getopts ":h:r:p:a:e:" arg; do
  case "${arg}" in
    h)
      ACE_DIRECT_HOME=${OPTARG}
      ;;
    r)
      RDPASS1=${OPTARG}
      ;;          
    p)
      ADPASS1=${OPTARG}
      ;;
    a)
      ASPASS1=${OPTARG}
      ;;
    e)
      EXPASS1=${OPTARG}
      ;;                  
    *)
      usage
      ;;
  esac
done
shift $((OPTIND-1))

if [ -z "${ACE_DIRECT_HOME}" ]; then
  usage
fi

# install Node.js
printf "Installing Node.js...\n"
cd ${ACE_DIRECT_HOME}
sudo rm -rf .nvm >/dev/null 2>&1
sudo rm -rf .n >/dev/null 2>&1
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
mkdir .n
npm install -g n
n 12.18.2
node -v  # make sure it is version 12.18.2
npm install -g pm2  # for process management
printf "\n"

# install REDIS
printf "Installing REDIS...\n"
# get the REDIS AUTH password
while true
do
  if [ ! -z "$RDPASS1" ]; then
    break
  fi
  printf "\n"
  read -p "${Q}Enter a REDIS AUTH password: " -rs
  RDPASS1=${REPLY}
  printf "\n"
  read -p "${Q}Please re-enter the REDIS AUTH password: " -rs
  RDPASS2=${REPLY}
  printf "\n"
  if [ "$RDPASS1" == "$RDPASS2" ]; then
    break
  fi
  printf "\n*** ERROR Passwords do not match! ***\n"
done
REDIS_AUTH=${RDPASS1}
printf "SUCCESS!\n\n"

cd ${ACE_DIRECT_HOME}
sudo rm -rf cd redis-stable >/dev/null 2>&1
sudo -E wget http://download.redis.io/redis-stable.tar.gz
tar xvzf redis-stable.tar.gz >/dev/null
cd redis-stable
sudo make distclean >/dev/null
sudo make >/dev/null
sudo make install >/dev/null
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
sudo service redis stop > /dev/null 2>&1
sudo service redis start
sudo service redis status

cd ${ACE_DIRECT_HOME}
sudo rm -f redis-stable.tar.gz >/dev/null 2>&1
sudo rm -rf redis-stable >/dev/null 2>&1
printf "\n"

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
printf "\n"

# Install MySQL
cd ${ACE_DIRECT_HOME}
printf "Installing MySQL...\n"
sudo systemctl stop mysqld.service  >/dev/null 2>&1  # stop it if it's already there
sudo yum -y remove mysql mysql-server >/dev/null 2>&1  # remove old version
sudo rm -rf /var/lib/mysql >/dev/null 2>&1
sudo rm -rf /etc/mysql >/dev/null 2>&1
sudo rm mysql57-community-release-el7-11.noarch.rpm* >/dev/null 2>&1
sudo yum update -y 
sudo -E wget https://dev.mysql.com/get/mysql57-community-release-el7-11.noarch.rpm
sudo yum -y localinstall mysql57-community-release-el7-11.noarch.rpm 
sudo yum -y install mysql-community-server
sudo rm mysql57-community-release-el7-11.noarch.rpm* >/dev/null 2>&1

# Start MySQL
printf "Installing MySQL as a service...\n"
sudo systemctl start mysqld.service  # if it fails: sudo systemctl daemon-reload
sudo systemctl status mysqld.service  # check status
sudo systemctl enable mysqld.service  # start at boot time

# get temporary MySQL root password
TEMP_ROOT_PWD=`sudo grep 'temporary password' /var/log/mysqld.log | tail -1 | awk '{print $NF}'`
printf "\n\nYour TEMPORARY MySQL ROOT PASSWORD IS: ${TEMP_ROOT_PWD}\n\n"
printf "PLEASE WRITE IT DOWN.\n"
printf "Securing MySQL...\n"
printf "You will now set security options and reset the ROOT PASSWORD...!\n"
printf "Log in with your TEMPORARY MYSQL ROOT PASSWORD...\n"

mysql_secure_installation

printf "Creating databases...\n"
# get the MySQL acedirect user password
while true
do
  if [ ! -z "$ADPASS1" ]; then
    break
  fi
  printf "\nEnter a password for the MySQL acedirect user.\n"
  printf "\nThe password must be at least 8 characters and an uppercase, lowercase, number, and special character.\n\n"
  read -p "${Q}Enter the new password: " -rs
  ADPASS1=${REPLY}
  printf "\n"
  read -p "${Q}Please re-enter the password: " -rs
  ADPASS2=${REPLY}
  printf "\n"
  if [ "$ADPASS1" == "$ADPASS2" ]; then
    break
  fi
  printf "\n*** ERROR Passwords do not match! ***\n"
done
printf "\n"

# get the MySQL asterisk user password
while true
do
  if [ ! -z "$ASPASS1" ]; then
    break
  fi
  printf "\nNOW enter a password for the MySQL asterisk user.\n"
  printf "\nThe password must be at least 8 characters and an uppercase, lowercase, number, and special character.\n\n"
  read -p "${Q}Enter the new password: " -rs
  ASPASS1=${REPLY}
  printf "\n"
  read -p "${Q}Please re-enter the password: " -rs
  ASPASS2=${REPLY}
  printf "\n"
  if [ "$ASPASS1" == "$ASPASS2" ]; then
    break
  fi
  printf "\n*** ERROR Passwords do not match! ***\n"
done
printf "\n"

# get the extensions password
while true
do
  if [ ! -z "$EXPASS1" ]; then
    break
  fi
  printf "\nWhat is the Asterisk extensions password?\n"
  printf "\nYou can find this on the Asterisk server. See the 'password=' field in the /etc/asterisk/pjsip.conf file.\n\n"
  read -p "${Q}Enter the extensions password: " -rs
  EXPASS1=${REPLY}
  printf "\n"
  read -p "${Q}Please re-enter extensions password: " -rs
  EXPASS2=${REPLY}
  printf "\n"
  if [ "$EXPASS1" == "$EXPASS2" ]; then
    break
  fi
  printf "\n*** ERROR Passwords do not match! ***\n"
done
printf "\n"

cd ${ACE_DIRECT_HOME}/ace-direct/dat
TMP1=/tmp/`date +%s`_file1.txt
TMP2=/tmp/`date +%s`_file2.txt
TMP3=/tmp/`date +%s`_file3.txt
cat acedirectdefault.sql | sed -e "s/_EXTENSION_PASSWORD_/${EXPASS1}/g" > $TMP1
cat $TMP1 | sed -e "s/_ACEDIRECT_PASSWORD_/${ADPASS1}/g" > $TMP2
cat $TMP2 | sed -e "s/_ASTERISK_PASSWORD_/${ASPASS1}/g" > $TMP3
cp $TMP3 acedirectdefault_NEW.sql
rm $TMP1 $TMP2 $TMP3 >/dev/null 2>&1
printf "Executing acedirectdefault.sql script...\n"
printf "\nPlease enter your current MySQL root password here...\n"
mysql -u root -p -h localhost < acedirectdefault_NEW.sql
rm acedirectdefault_NEW.sql
printf "Databases created.\n"

printf "done install_node.sh .\n\n"