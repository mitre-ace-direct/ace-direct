#!/bin/bash

OLDIFS=$IFS
RS='\u001b[0m'
FG_RED='\u001b[31m'
OK_ICON='✅'
NOTOK_ICON='❌'
Q='🤔 '

printf "\n"
printf "****************************************\n"
printf "*  ACE Direct acenode installation     *\n"
printf "****************************************\n"
printf "\n"

AD_USER=""
STUN_FQDN=""
TURN_FQDN=""
MAIN_FQDN=""
MAIN_IP=""
NGINX_FQDN=""
NGINX_IP=""
ASTERISK_FQDN=""
ASTERISK_IP=""
KURENTO_FQDN=""
KURENTO_IP=""
KEY_PEM=""
CERT_PEM=""

usage() {
  echo ""
  printf "usage:\n\n"
  echo "     $0 -u <AD home username> \\"
  echo "        -s <STUN_FQDN> \\"
  echo "        -t <TURN FQDN> \\"
  echo "        -m <Main FQDN and private IP> \\"
  echo "        -n <NGINX FQDN and private IP> \\"
  echo "        -k <Kurento FQDN and private IP> \\"
  echo "        -a <ASTERISK FQDN and private IP> \\"
  echo "        [-c <ssl cert file path>] \\"
  echo "        [-y <ssl key file path>]"
  echo ""
  echo "e.g."
  echo "     $0 -u ec2-user \\"
  echo "        -s acestun.domain.com \\"
  echo "        -t aceturn.domain.com \\"
  echo "        -m \"acenode.domain.com 1.0.0.1\" \\"
  echo "        -n \"portal.domain.com  1.0.0.2\" \\"
  echo "        -k \"acekms.domain.com  1.0.0.3\" \\"
  echo "        -a \"acesip.domain.com  1.0.0.4\" \\"
  echo "        -c /etc/ssl/cert.pem \\"  
  echo "        -y /etc/ssl/key.pem"
  echo ""
  exit 1;
}

while getopts ":u:s:t:m:n:k:a:c:y:" arg; do
  case "${arg}" in
    u)
      AD_USER=${OPTARG}
      ;;
    s)
      STUN_FQDN=${OPTARG}
      ;;
    t)
      TURN_FQDN=${OPTARG}
      ;;            
    m)
      set -f
      IFS=' '
      array=($OPTARG)
      MAIN_FQDN=${array[0]}
      MAIN_IP=${array[1]}
      ;;      
    n)
      set -f
      IFS=' '
      array=($OPTARG)
      NGINX_FQDN=${array[0]}
      NGINX_IP=${array[1]}    
      ;;
    k)
      set -f
      IFS=' '
      array=($OPTARG)
      KURENTO_FQDN=${array[0]}
      KURENTO_IP=${array[1]}        
      ;;
    a)
      set -f
      IFS=' '
      array=($OPTARG)
      ASTERISK_FQDN=${array[0]}
      ASTERISK_IP=${array[1]}        
      ;;
    c)
      CERT_PEM=${OPTARG}
      ;;
    y)
      KEY_PEM=${OPTARG}
      ;;                  
    *)
      usage
      ;;
  esac
done
shift $((OPTIND-1))

if [ -z "${AD_USER}" ] || [ -z "${STUN_FQDN}" ] || [ -z "${TURN_FQDN}" ] || [ -z "${MAIN_FQDN}" ] || [ -z "${MAIN_IP}" ] || [ -z "${NGINX_FQDN}" ] || [ -z "${NGINX_IP}" ] || [ -z "${ASTERISK_FQDN}" ] || [ -z "${ASTERISK_IP}" ] || [ -z "${KURENTO_FQDN}" ] || [ -z "${KURENTO_IP}" ]; then
  usage
fi
IFS=$OLDIFS

printf "Your params:\n\n"
printf "  AD USER:            ${AD_USER}\n"
printf "  STUN_FQDN:          ${STUN_FQDN}\n"
printf "  TURN FQDN:          ${TURN_FQDN}\n"
printf "  MAIN FQDN , IP:     ${MAIN_FQDN} , ${MAIN_IP}\n"
printf "  NGINX FQDN , IP:    ${NGINX_FQDN}  , ${NGINX_IP}\n"
printf "  KURENTO FQDN , IP:  ${KURENTO_FQDN}  , ${KURENTO_IP}\n"
printf "  ASTERISK FQDN , IP: ${ASTERISK_FQDN}  , ${ASTERISK_IP}\n"
printf "\n"

printf "This script will install the following components on acenode:\n"
printf "\n"
printf "Node servers\n"
printf "Redis\n"
printf "MongoDB\n"
printf "MySQL\n"
printf "NGINX\n"
printf "\n"

read -p "${Q}Continue (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
  printf ""
else
  printf "Aborting installation...\n\n"
  exit 1
fi

# make sure ace-direct repo was cloned in home folder
if cd ~/ace-direct >/dev/null 2>&1
then
  printf "Found ~/ace-direct folder ${OK_ICON}\n"
else
  printf "${FG_RED} error - ace-direct folder must be in the home folder: ~/ace-direct ${RS} ${NOTOK_ICON}\n"
  printf "Please clone the ace-direct repo to the home folder (e.g., /home/ec2-user/ace-direct).\n"
  printf "Exiting...\n"
  exit 1
fi

# get the REDIS AUTH password from the user
REDIS_AUTH=""
RDPASS1=""
RDPASS2=""
while true
do
  printf "\n"
  read -p "${Q}Enter a REDIS AUTH password: " -rs
  RDPASS1=${REPLY}
  printf "\n"
  read -p "${Q}Please re-enter the REDIS AUTH password: " -rs
  RDPASS2=${REPLY}
  printf "\n"
  if [ "$RDPASS1" == "$RDPASS2" ] && [ ! -z "${RDPASS1}" ] ; then
    break
  fi
  printf "\n*** ERROR Passwords do not match or are empty! Please try again... ***\n"
done
REDIS_AUTH=${RDPASS1}

# get the MySQL acedirect user password
ADPASS1=""
ADPASS2=""
while true
do
  printf "\nEnter a password for the MySQL acedirect user.\n"
  printf "The password must be at least 8 characters and an uppercase, lowercase, number, and special character.\n"
  read -p "${Q}Enter the password: " -rs
  ADPASS1=${REPLY}
  printf "\n"
  read -p "${Q}Please re-enter the password: " -rs
  ADPASS2=${REPLY}
  printf "\n"
  if [ "$ADPASS1" == "$ADPASS2" ] && [ ! -z "${ADPASS1}" ] ; then
    break
  fi
  printf "\n*** ERROR Passwords do not match or are empty! Please try again... ***\n"
done
printf "\n"

# get the MySQL asterisk user password
ASPASS1=""
ASPASS2=""
while true
do
  printf "Enter a password for the MySQL asterisk user.\n"
  printf "The password must be at least 8 characters and an uppercase, lowercase, number, and special character.\n"
  read -p "${Q}Enter the new password: " -rs
  ASPASS1=${REPLY}
  printf "\n"
  read -p "${Q}Please re-enter the password: " -rs
  ASPASS2=${REPLY}
  printf "\n"
  if [ "$ASPASS1" == "$ASPASS2" ] && [ ! -z "${ASPASS1}" ] ; then
    break
  fi
  printf "\n*** ERROR Passwords do not match or are empty! Please try again... ***\n"
done
printf "\n"

# get the Asterisk AMI userid and password
printf "Please supply the Asterisk AMI userid and password...\n"
printf "You can find this on the Asterisk server in /etc/asterisk/manager.conf...\n"
AMUSER=""
AMPASS1=""
AMPASS2=""
while true
do
  read -p "${Q}Enter the Asterisk AMI userid: " -r
  AMUSER=${REPLY}
  read -p "${Q}Enter the Asterisk AMI password: " -rs
  AMPASS1=${REPLY}
  printf "\n"
  read -p "${Q}Re-enter the Asterisk AMI password: " -rs
  AMPASS2=${REPLY}
  printf "\n"
  if [ "$AMPASS1" == "$AMPASS2" ] && [ ! -z "${AMPASS1}" ]  && [ ! -z "${AMUSER}" ] ; then
    break
  fi
  printf "\n*** ERROR Passwords do not match or some fields are empty! Please try again... ***\n"
done
printf "\n"

# get the Asterisk extensions password
EXPASS1=""
EXPASS2=""
while true
do
  printf "What is the Asterisk extensions password?\n"
  printf "Get this from the 'password=' field in the /etc/asterisk/pjsip.conf file.\n"
  read -p "${Q}Enter the extensions password: " -rs
  EXPASS1=${REPLY}
  printf "\n"
  read -p "${Q}Please re-enter extensions password: " -rs
  EXPASS2=${REPLY}
  printf "\n"
  if [ "$EXPASS1" == "$EXPASS2" ] && [ ! -z "${EXPASS1}" ] ; then
    break
  fi
  printf "\n*** ERROR Passwords do not match or are empty! Please try again... ***\n"
done
printf "\n"

# get the turn user, turn password, stun user
printf "Please supply the STUN server user, TURN server user and password...\n"
printf "Retrieve these values from your TURN and STUN installations...\n"
STUNUSER=
TURNUSER=""
TURNPASS1=""
TURNPASS2=""
while true
do
  read -p "${Q}Enter the STUN user: " -r
  STUNUSER=${REPLY}
  read -p "${Q}Enter the TURN user: " -r
  TURNUSER=${REPLY}  
  read -p "${Q}Enter the TURN password: " -rs
  TURNPASS1=${REPLY}
  printf "\n"
  read -p "${Q}Re-enter the TURN password: " -rs
  TURNPASS2=${REPLY}
  printf "\n"
  if [ "$TURNPASS1" == "$TURNPASS2" ] && [ ! -z "${TURNPASS1}" ]  && [ ! -z "${STUNUSER}" ] && [ ! -z "${TURNUSER}" ] ; then
    break
  fi
  printf "\n*** ERROR Passwords do not match or some fields are empty! Please try again... ***\n"
done
printf "\n"

# config file

# back up config if it's there
if [ -f dat/config.json ]; then
  CONFIG_BKUP=dat/config_backup_`date +%s`.json
  printf "Backing up existing dat/config.json file to: ${CONFIG_BKUP} .\n"
  cp dat/config.json $CONFIG_BKUP >/dev/null 2>&1
fi

# copy template to config
cp dat/config.json_TEMPLATE dat/config.json

# Update vars in config.json
TMP_CONFIG1=dat/config_temp1_`date +%s`.json
TMP_CONFIG2=dat/config_temp2_`date +%s`.json
python scripts/parseSingleJson.py dat/config.json servers:main_fqdn $MAIN_FQDN > $TMP_CONFIG1
python scripts/parseSingleJson.py $TMP_CONFIG1 servers:main_private_ip $MAIN_IP > $TMP_CONFIG2
python scripts/parseSingleJson.py $TMP_CONFIG2 servers:nginx_fqdn $NGINX_FQDN > $TMP_CONFIG1
python scripts/parseSingleJson.py $TMP_CONFIG1 servers:nginx_private_ip $NGINX_IP > $TMP_CONFIG2 
python scripts/parseSingleJson.py $TMP_CONFIG2 servers:asterisk_fqdn $ASTERISK_FQDN > $TMP_CONFIG1 
python scripts/parseSingleJson.py $TMP_CONFIG1 servers:asterisk_private_ip $ASTERISK_IP > $TMP_CONFIG2 
python scripts/parseSingleJson.py $TMP_CONFIG2 servers:stun_fqdn $STUN_FQDN > $TMP_CONFIG1
python scripts/parseSingleJson.py $TMP_CONFIG1 servers:turn_fqdn $TURN_FQDN > $TMP_CONFIG2
python scripts/parseSingleJson.py $TMP_CONFIG2 servers:kurento_fqdn $KURENTO_FQDN > $TMP_CONFIG1 
python scripts/parseSingleJson.py $TMP_CONFIG1 servers:kurento_private_ip $KURENTO_IP > $TMP_CONFIG2 
python scripts/parseSingleJson.py $TMP_CONFIG2 signaling_server:path "/${AD_USER}/acedirect-kurento/signaling" > $TMP_CONFIG1
python scripts/parseSingleJson.py $TMP_CONFIG1 database_servers:redis:auth $REDIS_AUTH > $TMP_CONFIG2 
python scripts/parseSingleJson.py $TMP_CONFIG2 database_servers:mysql:password $ADPASS1 > $TMP_CONFIG1 
python scripts/parseSingleJson.py $TMP_CONFIG1 asterisk:ami:passwd $AMPASS1 > $TMP_CONFIG2 
python scripts/parseSingleJson.py $TMP_CONFIG2 asterisk:ami:id $AMUSER > $TMP_CONFIG1
python scripts/parseSingleJson.py $TMP_CONFIG1 asterisk:sip:stun_user $STUNUSER > $TMP_CONFIG2 
python scripts/parseSingleJson.py $TMP_CONFIG2 asterisk:sip:turn_user $TURNUSER > $TMP_CONFIG1 
python scripts/parseSingleJson.py $TMP_CONFIG1 asterisk:sip:turn_cred $TURNPASS1 > $TMP_CONFIG2 
python scripts/parseSingleJson.py $TMP_CONFIG2 asterisk:extensions:secret $EXPASS1 > $TMP_CONFIG1 
python scripts/parseArrayJson.py $TMP_CONFIG1 videomail:agents 0 sipPass $EXPASS1 > $TMP_CONFIG2 
python scripts/parseArrayJson.py $TMP_CONFIG2 videomail:agents 1 sipPass $EXPASS1 > $TMP_CONFIG1 
python scripts/parseArrayJson.py $TMP_CONFIG1 videomail:agents 2 sipPass $EXPASS1 > $TMP_CONFIG2 
python scripts/parseArrayJson.py $TMP_CONFIG2 videomail:agents 3 sipPass $EXPASS1 > $TMP_CONFIG1 
python scripts/parseArrayJson.py $TMP_CONFIG1 videomail:agents 4 sipPass $EXPASS1 > $TMP_CONFIG2 

cp $TMP_CONFIG2 dat/config.json

rm $TMP_CONFIG1 $TMP_CONFIG2 >/dev/null 2>&1

# get pem file locations from config if not sent on command line
if [ -z "$KEY_PEM" ]; then
  KEY_PEM=`python scripts/parseSingleJson.py dat/config.json common:https:private_key`
else
  python scripts/parseSingleJson.py dat/config.json common:https:private_key ${KEY_PEM} > $TMP_CONFIG1
  cp $TMP_CONFIG1 dat/config.json
  rm $TMP_CONFIG1
fi
if [ -z "$CERT_PEM" ]; then
  CERT_PEM=`python scripts/parseSingleJson.py dat/config.json common:https:certificate`
else
  python scripts/parseSingleJson.py dat/config.json common:https:certificate ${CERT_PEM} > $TMP_CONFIG1
  cp $TMP_CONFIG1 dat/config.json
  rm $TMP_CONFIG1
fi

# validate certs
printf "validatig certs...\n"
if [[ ! -f ${KEY_PEM} || ! -f ${CERT_PEM} ]]; then
  printf "${NOTOK_ICON} error - One or both cert files are missing...\n\n"
  exit 99
else
  printf "Verifying certs...\n"
  if openssl x509 -checkend 86400 -noout -in ${CERT_PEM}
  then
    printf "${CERT_PEM} is good!\n"  
  else
    printf "\n\n"
    printf "${NOTOK_ICON} error - ${CERT_PEM} has expired or will expire within 24 hours, please acquire new certs\n\n\n"
    exit 99
  fi
fi


# BEGIN INSTALLATION
INSTALL_START=`date +%s` # start the clock
printf "\n"

# check for Git
if git --version >/dev/null 2>&1
then
  printf "${OK_ICON} found git\n"
else
  printf "No git, installing now...\n"
  sudo yum install git -y
fi
# create .gitconfig file
echo '[url "https://"]' > ~/.gitconfig
echo '    insteadOf = git://' >> ~/.gitconfig
printf "\n"

# check for cc
if which cc >/dev/null 2>&1
then
  printf "${OK_ICON} found cc\n"
else
  printf "No cc, installing now...\n"
  sudo yum -y groupinstall "Development Tools"
fi
printf "\n"

# check for sudo permissions
printf "Checking sudo permissions...\n"
if sudo ls >/dev/null 2>&1
then
  printf "${OK_ICON} sudo permissions good\n"
else
  printf "${NOTOK_ICON} No sudo permissions! exiting...\n\n"
  exit 99
fi
printf "\n"

# verify HOME account/folder
set -f
IFS='/'
array=(${HOME})
HOME_USER=${array[${#array[@]} - 1]}
if [[ "$HOME_USER" != "${AD_USER}" ]]
then
  printf "${NOTOK_ICON} ACE Direct user does not match actual home user account. Exiting...\n" 
  exit 99
else
  printf "${OK_ICON} user account matches\n" 
fi

IFS=$OLDIFS
printf "\nBeginning installation...\n\n"

read -p "${Q}Install core node components (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
  # install node components
  acedirect/install_node.sh -h /home/${AD_USER} -r ${REDIS_AUTH} -p ${ADPASS1} -a ${ASPASS1} -e ${EXPASS1}
fi

read -p "${Q}Build ace-direct (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
  # build AD
  cd ~/ace-direct
  scripts/build.sh
fi

# done
INSTALL_END=`date +%s`
EQU="scale=2; (${INSTALL_END} - ${INSTALL_START})/60"
RESULT=`bc <<< $EQU`
printf "\n*** Installation took $RESULT minutes. ***\n\n"
printf "\n\ndone.\n"
