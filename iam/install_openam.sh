#!/bin/bash

# This script performs a DEFAULT installation of OpenAM.
# To customize the installation, follow the manual instructions in the README.md file.
# Or... update the configuration files before executing this script
#
# Assumptions:
# * The ace-direct/iam folder is copied to /root/iam
# * This is the root user, /root
# * Python is already installed

if [ "$#" -ne 4 ]; then
  printf "\nusage:  $0  <base name>  <OPENAM FQDN>  <NGINX FQDN>  <TOMCAT VERSION> \n"
  printf "e.g.    $0  ace  aceopenam.domain.com  portal.domain.com  7.0.108 \n\n"
  exit 99
fi

printf "\n\nInstalling OpenAM...\n\n"

HOME_FOLDER="/root"
HOME_USER="root"
BASE_NAME=$1
FQDN=$2
NGINX_FQDN=$3
TOMCAT_VERSION=$4
ROOT_FOLDER=`pwd`

arr=(${FQDN//./ })
CD=""
for (( i=1; i<${#arr[@]}; i++ ));
do
  CD=${CD}'.'${arr[$i]}
done

# make sure Python is installed
printf "Checking for Python...\n"
if ! python -V >/dev/null 2>&1; then
  printf "\nerror - please install Python 2.7\n\n"
  printf "aborting...\n\n"
  exit 99
fi

# install the latest Java version
printf "Installing Java...\n"
cd scripts
python java_installer.py silent
cd $ROOT_FOLDER

JAVA_FULL_PATH=`echo $(dirname $(dirname $(readlink -f $(which javac))))`
TEMP=${JAVA_FULL_PATH}"/"
arr=(${TEMP//\// })
JAVA_FOLDER=${arr[-1]}   

# make sure FQDNs do not have underscores (_)
printf "Validating FQDNs...\n"
if [[ "$FQDN" == *"_"* || "$NGINX_FQDN" == *"_"* ]]; then
  printf "\nerror - FQDN or NGINX FQDN may not contain underscores\n\n"
  printf "aborting...\n\n"
  exit 99
fi

# check for certs and make sure they are valid
printf "Checking certs...\n"
if [[ ! -f ssl/cert.pem || ! -f ssl/key.pem ]]; then
  printf "\n\nerror - cert.pem or key.pem not found in ssl directory\n"
  printf "        Please make sure that cert.pem and key.pem are in ${HOME_FOLDER}/iam/ssl\n\n"
  printf "aborting...\n\n"
  exit 99
else
  # update permissions and ownership
  cd ssl
  chown ${HOME_USER} cert.pem
  chgrp ${HOME_USER} cert.pem
  chown ${HOME_USER} key.pem
  chgrp ${HOME_USER} key.pem
  chmod 644 cert.pem key.pem 
fi

# update environment files
 
printf "Updating environment files...\n"
echo '' >> ~/.bashrc
echo '# OpenAM setup' >> ~/.bashrc
echo "OPENAM_BASE_NAME=${BASE_NAME}" >> ~/.bashrc
echo 'JAVA_HOME=`echo $(dirname $(dirname $(readlink -f $(which javac))))`' >> ~/.bashrc
echo 'JRE_HOME=${JAVA_HOME}' >> ~/.bashrc
echo 'JAVA_OPTS="-server  -Xmx2048m -Xms128m  -XX:+UseConcMarkSweepGC -XX:+UseSerialGC"' >> ~/.bashrc
echo 'PATH=$PATH:$JAVA_HOME/bin' >> ~/.bashrc
echo 'export PATH JAVA_HOME JRE_HOME OPENAM_BASE_NAME JAVA_OPTS' >> ~/.bashrc
echo '' >> ~/.bashrc

echo '' >> ~/.bash_profile
echo '# OpenAM setup' >> ~/.bash_profile
echo "OPENAM_BASE_NAME=${BASE_NAME}" >> ~/.bash_profile
echo 'JAVA_HOME=`echo $(dirname $(dirname $(readlink -f $(which javac))))`' >> ~/.bash_profile
echo 'JRE_HOME=${JAVA_HOME}' >> ~/.bash_profile
echo 'JAVA_OPTS="-server  -Xmx2048m -Xms128m  -XX:+UseConcMarkSweepGC -XX:+UseSerialGC"' >> ~/.bash_profile
echo 'PATH=$PATH:$JAVA_HOME/bin' >> ~/.bash_profile
echo 'export PATH JAVA_HOME JRE_HOME OPENAM_BASE_NAME JAVA_OPTS' >> ~/.bash_profile
echo '' >> ~/.bash_profile

# Stop any previous OpenAM installation and delete it completely
printf "Stop and delete previous OpenAM installations...\n"
echo '' >> ~/.bashrc
source ${HOME_FOLDER}/.bashrc
service tomcat stop >/dev/null 2>&1
userdel -r tomcat >/dev/null 2>&1
rm -rf /opt/tomcat >/dev/null 2>&1
rm -rf /etc/systemd/system/tomcat.service >/dev/null 2>&1
rm ${HOME_FOLDER}/iam/ssl/.keystore >/dev/null 2>&1
rm ${HOME_FOLDER}/iam/ssl/cert.p12 >/dev/null 2>&1
rm -rf ${HOME_FOLDER}/.openamcfg >/dev/null 2>&1
rm -rf ${HOME_FOLDER}/iam/config/oam/SSOAdminTools-13.0.0 >/dev/null 2>&1
rm -rf ${HOME_FOLDER}/iam/config/oam/SSOConfiguratorTools-13.0.0 >/dev/null 2>&1

# edit config.json
printf "Editing config.json...\n"
cd ${HOME_FOLDER}/iam
tmpfile="/tmp/"`date +%s.%N`"_tempfile.txt"
re1='^[[:space:]]*"java"'
re2='^[[:space:]]*"tomcat"'
re3='^[[:space:]]*"ssoadm_file"'
re4='^[[:space:]]*"war_file"'
re5='^[[:space:]]*"admin_pwd_file"'
echo "" > $tmpfile
while IFS= read -r line; do
  if [[ $line =~ $re1 ]] ;
  then
    # update java version
    printf "        \"java\": \"${JAVA_FOLDER}\",\n" >> $tmpfile
  elif [[ $line =~ $re2 ]] ;
  then
    # update tomcat version
    printf "        \"tomcat\": \"${TOMCAT_VERSION}\"\n" >> $tmpfile
  elif [[ $line =~ $re3 ]] ;
  then
    # update ssoadm_file
    printf "        \"ssoadm_file\": \"../config/oam/SSOAdminTools-13.0.0/${BASE_NAME}/bin/ssoadm\",\n" >> $tmpfile
  elif [[ $line =~ $re4 ]] ;
  then
    # update war_file 
    printf "        \"war_file\": \"../config/oam/${BASE_NAME}.war\",\n" >> $tmpfile
  elif [[ $line =~ $re5 ]] ;
  then
    # update war_file 
    printf "        \"admin_pwd_file\": \"../config/oam/SSOAdminTools-13.0.0/${BASE_NAME}/bin/pwd.txt\",\n" >> $tmpfile
  else
    printf "$line\n" >> $tmpfile
  fi
done < config/config.json
mv $tmpfile config/config.json

# OpenAM configuration
printf "Getting OpenAM war file...\n"
cd ${HOME_FOLDER}
rm -rf openam >/dev/null 2>&1
wget --no-check-certificate https://github.com/OpenIdentityPlatform/OpenAM/releases/download/13.0.0/OpenAM-13.0.0.zip
unzip OpenAM-13.0.0.zip
rm OpenAM-13.0.0.zip
cp ${HOME_FOLDER}/openam/OpenAM-13.0.0.war ${HOME_FOLDER}/iam/config/oam/${BASE_NAME}.war

printf "Getting OpenAM admin tools...\n"
cd ${HOME_FOLDER}/iam/config/oam
mkdir SSOAdminTools-13.0.0
cd SSOAdminTools-13.0.0
wget --no-check-certificate https://github.com/OpenIdentityPlatform/OpenAM/releases/download/13.0.0/SSOAdminTools-13.0.0.zip
unzip SSOAdminTools-13.0.0.zip
rm -f SSOAdminTools-13.0.0.zip
cd ${HOME_FOLDER}/iam/config/oam
mkdir SSOConfiguratorTools-13.0.0
cd SSOConfiguratorTools-13.0.0 
printf "Getting OpenAM configurator tools...\n"
wget --no-check-certificate https://github.com/OpenIdentityPlatform/OpenAM/releases/download/13.0.0/SSOConfiguratorTools-13.0.0.zip
unzip SSOConfiguratorTools-13.0.0.zip
rm -f SSOConfiguratorTools-13.0.0.zip

# edit Tomcat service file
printf "Editing tomcat service file...\n"
cd ${HOME_FOLDER}/iam
tmpfile="/tmp/"`date +%s.%N`"_tempfile.txt"
re1='^[[:space:]]*Environment=JAVA_HOME'
re2='^[[:space:]]*Environment=JRE_HOME'
echo "" > $tmpfile
while IFS= read -r line; do
  if [[ $line =~ $re1 ]] ;
  then
    # update Java home
    printf "Environment=JAVA_HOME=${JAVA_FULL_PATH}\n" >> $tmpfile
  elif [[ $line =~ $re2 ]] ;
  then
    # update JRE home
    printf "Environment=JRE_HOME=${JAVA_FULL_PATH}\n" >> $tmpfile
  else
    printf "$line\n" >> $tmpfile
  fi
done < config/tomcat/tomcat.service
mv $tmpfile config/tomcat/tomcat.service

# edit OpenAM properties file
printf "Editing OpenAM properties file...\n"
cd ${HOME_FOLDER}/iam
tmpfile="/tmp/"`date +%s.%N`"_tempfile.txt"
re1='^[[:space:]]*SERVER_URL='
re2='^[[:space:]]*DEPLOYMENT_URI='
re3='^[[:space:]]*BASE_DIR='
re4='^[[:space:]]*COOKIE_DOMAIN='
re5='^[[:space:]]*DIRECTORY_SERVER='
echo "" > $tmpfile
while IFS= read -r line; do
  if [[ $line =~ $re1 ]] ;
  then
    # update server URL
    printf "SERVER_URL=https://${FQDN}:8443\n" >> $tmpfile
  elif [[ $line =~ $re2 ]] ;
  then
    # update deployment URI
    printf "DEPLOYMENT_URI=/${BASE_NAME}\n" >> $tmpfile
  elif [[ $line =~ $re3 ]] ;
  then
    # update BASE_DIR
    printf "BASE_DIR=/opt/tomcat/webapps/${BASE_NAME}\n" >> $tmpfile
  elif [[ $line =~ $re4 ]] ;
  then
    # update cookie domain
    printf "COOKIE_DOMAIN=${CD}\n" >> $tmpfile
  elif [[ $line =~ $re5 ]] ;
  then
    # update directory server
    printf "DIRECTORY_SERVER=${FQDN}\n" >> $tmpfile
  else
    printf "$line\n" >> $tmpfile
  fi
done < config/oam/config.properties
mv $tmpfile config/oam/config.properties

# BEGIN installation
printf "Installing...\n"
cd ${HOME_FOLDER}/iam/scripts
python keystore.py 
python tomcat_installer.py -silent 
python oam_installer.py -silent

# make sure openam is running
if curl -k https://localhost:8443 ; then
  echo "OpenAM is running."
else
  echo "error - OpenAM is NOT running."
  printf "aborting...\n\n"
  exit 99
fi

# set up OpenAM admin tools
printf "Set up OpenAM admin tools...\n"
cd ${HOME_FOLDER}/iam/config/oam/SSOAdminTools-13.0.0 
if sudo -E bash setup -p /opt/tomcat/webapps/${BASE_NAME} -l ./log -d ./debug --acceptLicense  ; then
  echo "OpenAM is license accepted."
else
  echo "error - OpenAM license NOT accepted."
  printf "aborting...\n\n"
  exit 99
fi

cd ${HOME_FOLDER}/iam/config/oam/SSOAdminTools-13.0.0/${BASE_NAME}/bin
tmpfile="/tmp/"`date +%s.%N`"_tempfile.txt"
head -n -1 ssoadm > $tmpfile
printf '    -D"javax.net.ssl.trustStore="/root/iam/ssl/.keystore" \\\n'  >> $tmpfile
printf '    -D"javax.net.ssl.trustStorePassword="changeit"  \\\n'  >> $tmpfile
printf '    com.sun.identity.cli.CommandManager "$@" \n' >> $tmpfile
mv $tmpfile ${HOME_FOLDER}/iam/config/oam/SSOAdminTools-13.0.0/${BASE_NAME}/bin/ssoadm
chmod 755 ${HOME_FOLDER}/iam/config/oam/SSOAdminTools-13.0.0/${BASE_NAME}/bin/ssoadm

# verify ssoadm
printf "verifying ssoadm...\n"
cd  ${HOME_FOLDER}/iam/config/oam/SSOAdminTools-13.0.0/${BASE_NAME}/bin
echo password1 > pwd.txt
chmod 400 pwd.txt
./ssoadm list-servers -u amadmin -f pwd.txt >/dev/null 2>&1   # optional?

# create OpenAM agents/users
printf "Creating OpenAM agents/users...\n"
cd ${HOME_FOLDER}/iam/scripts
if python create_users.py ; then
  echo "OpenAM agents/users created."
else
  echo "error - OpenAM agents/users NOT created."
  printf "aborting...\n\n"
  exit 99
fi

# secure GOTO redirects
printf "Securing GOTO redirects...\n"
cd  ${HOME_FOLDER}/iam/config/oam/SSOAdminTools-13.0.0/${BASE_NAME}/bin
if  ./ssoadm set-attr-defs -s validationService -t organization -u amadmin -f pwd.txt -a openam-auth-valid-goto-resources="https://${NGINX_FQDN}/*" openam-auth-valid-goto-resources="https://${NGINX_FQDN}/*?*"  ; then
  echo "secured GOTO redirects."
else
  echo "error - failed to secure GOTO redirects."
  printf "aborting...\n\n"
  exit 99
fi

# clean up
rm -rf ${HOME_FOLDER}/openam >/dev/null 2>&1

# check service status
printf "\nchecking Tomcat status:\n"
if service tomcat status  ; then
  echo "OpenAM status check OK."
else
  echo "error - OpenAM status check FAILED."
  printf "aborting...\n\n"
  exit 99
fi
printf "\n"

echo ""
echo " ▒█████   ██▓███  ▓█████  ███▄    █  ▄▄▄       ███▄ ▄███▓"
echo "▒██▒  ██▒▓██░  ██▒▓█   ▀  ██ ▀█   █ ▒████▄    ▓██▒▀█▀ ██▒"
echo "▒██░  ██▒▓██░ ██▓▒▒███   ▓██  ▀█ ██▒▒██  ▀█▄  ▓██    ▓██░"
echo "▒██   ██░▒██▄█▓▒ ▒▒▓█  ▄ ▓██▒  ▐▌██▒░██▄▄▄▄██ ▒██    ▒██ "
echo "░ ████▓▒░▒██▒ ░  ░░▒████▒▒██░   ▓██░ ▓█   ▓██▒▒██▒   ░██▒"
echo "░ ▒░▒░▒░ ▒▓▒░ ░  ░░░ ▒░ ░░ ▒░   ▒ ▒  ▒▒   ▓▒█░░ ▒░   ░  ░"
echo "  ░ ▒ ▒░ ░▒ ░      ░ ░  ░░ ░░   ░ ▒░  ▒   ▒▒ ░░  ░      ░"
echo "░ ░ ░ ▒  ░░          ░      ░   ░ ░   ░   ▒   ░      ░   "
echo "    ░ ░              ░  ░         ░       ░  ░       ░   "
echo ""                                                         
echo " Success!"
echo ""                                         
echo "done."
echo ""   