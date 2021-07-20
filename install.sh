#!/bin/bash

INSTALL_START=`date +%s`
RS='\u001b[0m'
FG_RED='\u001b[31m'
OK_ICON='✅'
NOTOK_ICON='❌'

AD_USER=""
STUN_FQDN=""
TURN_FQDN=""
OPENAM_FQDN=""
MAIN_FQDN=""
MAIN_IP=""
NGINX_FQDN=""
NGINX_IP=""
ASTERISK_FQDN=""
ASTERISK_IP=""
KURENTO_FQDN=""
KURENTO_IP=""

usage() {
  echo ""
  printf "usage:\n\n"
  echo "     $0 [-u <AD home username>] \\"
  echo "        [-s <STUN_FQDN>] \\"
  echo "        [-t <TURN FQDN>] \\"
  echo "        [-o <OpenAM FQDN>] \\"  
  echo "        [-m <Main FQDN and private IP>] \\"
  echo "        [-n <NGINX FQDN and private IP>] \\"
  echo "        [-k <Kurento FQDN and private IP>] \\"
  echo "        [-a <ASTERISK FQDN and private IP>]"
  echo ""
  echo "e.g."
  echo "     $0 -u ec2-user \\"
  echo "        -s acestun.domain.com \\"
  echo "        -t aceturn.domain.com \\"
  echo "        -o portal.domain.com \\"  
  echo "        -m \"acenode.domain.com 1.0.0.1\" \\"
  echo "        -n \"portal.domain.com  1.0.0.2\" \\"
  echo "        -k \"acekms.domain.com  1.0.0.3\" \\"
  echo "        -a \"acesip.domain.com  1.0.0.4\""
  echo ""
  exit 1;
}

while getopts ":u:s:t:o:m:n:k:a:" arg; do
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
    o)
      OPENAM_FQDN=${OPTARG}
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
    *)
      usage
      ;;
  esac
done
shift $((OPTIND-1))

if [ -z "${AD_USER}" ] || [ -z "${STUN_FQDN}" ] || [ -z "${TURN_FQDN}" ] || [ -z "${OPENAM_FQDN}" ] || [ -z "${MAIN_FQDN}" ] || [ -z "${MAIN_IP}" ] || [ -z "${NGINX_FQDN}" ] || [ -z "${NGINX_IP}" ] || [ -z "${ASTERISK_FQDN}" ] || [ -z "${ASTERISK_IP}" ] || [ -z "${KURENTO_FQDN}" ] || [ -z "${KURENTO_IP}" ]; then
  usage
fi

printf "\nUsing params:\n\n"
printf "  AD USER:            ${AD_USER}\n"
printf "  STUN_FQDN:          ${STUN_FQDN}\n"
printf "  TURN FQDN:          ${TURN_FQDN}\n"
printf "  OPENAM FQDN:        ${OPENAM_FQDN}\n"
printf "  MAIN FQDN , IP:     ${MAIN_FQDN} , ${MAIN_IP}\n"
printf "  NGINX FQDN , IP:    ${NGINX_FQDN}  , ${NGINX_IP}\n"
printf "  KURENTO FQDN , IP:  ${KURENTO_FQDN}  , ${KURENTO_IP}\n"
printf "  ASTERISK FQDN , IP: ${ASTERISK_FQDN}  , ${ASTERISK_IP}\n"
printf "\n"

read -p "Do you wish to continue (y/n)? " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]
then
  printf "\n\nContinuing...\n\n"
else
  printf "\n\nABORTING...\n\n"
  exit 1
fi

# ask some questions

# get the REDIS AUTH password from the user
REDIS_AUTH=""
RDPASS1=""
RDPASS2=""
while true
do
  printf "\n"
  read -p "Enter a REDIS AUTH password: " -rs
  RDPASS1=${REPLY}
  printf "\n"
  read -p "Please re-enter the REDIS AUTH password: " -rs
  RDPASS2=${REPLY}
  printf "\n"
  if [ "$RDPASS1" == "$RDPASS2" ]; then
    break
  fi
  printf "\n*** ERROR Passwords do not match! ***\n"
done
REDIS_AUTH=${RDPASS1}

# get the MySQL acedirect user password
ADPASS1=""
ADPASS2=""
while true
do
  printf "\nEnter a password for the MySQL acedirect user.\n"
  printf "\nThe password must be at least 8 characters and an uppercase, lowercase, number, and special character.\n\n"
  read -p "Enter the new password: " -rs
  ADPASS1=${REPLY}
  printf "\n"
  read -p "Please re-enter the password: " -rs
  ADPASS2=${REPLY}
  printf "\n"
  if [ "$ADPASS1" == "$ADPASS2" ]; then
    break
  fi
  printf "\n*** ERROR Passwords do not match! ***\n"
done

printf "SUCCESS!\n\n"

# get the MySQL asterisk user password
ASPASS1=""
ASPASS2=""
while true
do
  printf "\nNOW enter a password for the MySQL asterisk user.\n"
  printf "\nThe password must be at least 8 characters and an uppercase, lowercase, number, and special character.\n\n"
  read -p "Enter the new password: " -rs
  ASPASS1=${REPLY}
  printf "\n"
  read -p "Please re-enter the password: " -rs
  ASPASS2=${REPLY}
  printf "\n"
  if [ "$ASPASS1" == "$ASPASS2" ]; then
    break
  fi
  printf "\n*** ERROR Passwords do not match! ***\n"
done

printf "SUCCESS!\n\n"

# get the extensions password
EXPASS1=""
EXPASS2=""
while true
do
  printf "\nWhat is the Asterisk extensions password?\n"
  printf "\nYou can find this on the Asterisk server. See the 'password=' field in the /etc/asterisk/pjsip.conf file.\n\n"
  read -p "Enter the extensions password: " -rs
  EXPASS1=${REPLY}
  printf "\n"
  read -p "Please re-enter extensions password: " -rs
  EXPASS2=${REPLY}
  printf "\n"
  if [ "$EXPASS1" == "$EXPASS2" ]; then
    break
  fi
  printf "\n*** ERROR Passwords do not match! ***\n"
done

# config file

# back up config if it's there
CONFIG_BKUP=dat/config_backup_`date +%s`.json
cp dat/config.json $CONFIG_BKUP >/dev/null 2>&1

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

cp $TMP_CONFIG1 dat/config.json
rm $TMP_CONFIG1 $TMP_CONFIG2 >/dev/null 2>&1

# check for Git
if git --version >/dev/null 2>&1
then
  printf "${OK_ICON} found git\n"
else
  printf "No git, installing now...\n"
  sudo yum install git -y
fi

# check for cc
if which cc >/dev/null 2>&1
then
  printf "${OK_ICON} found cc\n"
else
  printf "No cc, installing now...\n"
  sudo yum groupinstall "Development Tools"
fi

# check for sudo permissions
if sudo ls >/dev/null 2>&1
then
  printf "${OK_ICON} sudo permissions good\n"
else
  printf "${NOTOK_ICON} No sudo permissions! exiting...\n\n"
  exit 99
fi

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

printf "\n\nBeginning installation...\n\n"

# install node components
acedirect/install_node.sh -h /home/${AD_USER}

# install Node.js
nginx/install_nginx.sh -u ${AD_USER} -o ${OPENAM_FQDN} -a ${MAIN_FQDN}

# install OpenAM
cd ~/ace-direct/iam
iam/install_openam.sh  ace  ${OPENAM_FQDN}  ${NGINX_FQDN}  7.0.108 

# build AD
cd ~/ace-direct
scripts/build.sh

INSTALL_END=`date +%s`

EQU="scale=2; (${INSTALL_END} - ${INSTALL_START})/60"
RESULT=`bc <<< $EQU`
echo "\n*** Installation took $RESULT minutes. ***\n\n"
printf "\n\n\ndone.\n\n"