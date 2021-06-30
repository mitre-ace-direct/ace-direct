#!/bin/bash

echo "Checking servers..."

STATUS="\n***************************************************\n\n  SERVER STATUS:\n\n"

STUN_FQDN=`node ./acedirect/parseJson.js servers:stun_fqdn`
TURN_FQDN=`node ./acedirect/parseJson.js servers:turn_fqdn`
KURENTO_FQDN=`node ./acedirect/parseJson.js servers:kurento_fqdn`
ASTERISK_FQDN=`node ./acedirect/parseJson.js servers:asterisk_fqdn`
MAIN_FQDN=`node ./acedirect/parseJson.js servers:main_fqdn`
REDIS_FQDN=`node ./acedirect/parseJson.js servers:redis_fqdn`
NGINX_FQDN=`node ./acedirect/parseJson.js servers:nginx_fqdn`
OPENAM_PATH=`node ./acedirect/parseJson.js openam:path`
RESET_COLORS='\u001b[0m'
FG_RED='\u001b[31m'
OK_ICON='✅'
NOTOK_ICON='❌'

for ((i = 0; i < 8; ++i)); do
  PM2_STATUS=`pm2 show ${i} | grep status | awk '{ print $4 }' | sed 's/ //g'`
  FG=''
  ICON=${OK_ICON}
  if [[ "$PM2_STATUS" != "online" ]]
  then
    FG=${FG_RED}
  ICON=${NOTOK_ICON}
  fi
  STATUS="${STATUS}  ${ICON}  pm2 status ${i}: ${FG}${PM2_STATUS}${RESET_COLORS}\n" 
done


# Check MAIN
DISK_USAGE=`ssh "${USER}@${MAIN_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${NOTOK_ICON}  ${MAIN_FQDN}  disk usage is ${FG_RED}${DISK_USAGE}%%  ${RESET_COLORS}\n"
else
  STATUS="${STATUS}  ${OK_ICON}  ${MAIN_FQDN}  disk usage is ${DISK_USAGE}%%\n"
fi

# Check STUN
if ssh "${USER}@${STUN_FQDN}" sudo netstat -tnlp | grep 3478
then
  STATUS="${STATUS}  ${OK_ICON}  ${STUN_FQDN} is UP.\n"
else
  STATUS="${STATUS}  ${NOTOK_ICON}  ${STUN_FQDN} is ${FG_RED}DOWN${RESET_COLORS}\n"
fi
DISK_USAGE=`ssh "${USER}@${STUN_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${NOTOK_ICON}  ${STUN_FQDN}  disk usage is ${FG_RED}${DISK_USAGE}%%  ${RESET_COLORS}\n"
fi

# Check TURN 
if ssh "${USER}@${TURN_FQDN}" sudo netstat -tnlp | grep 3478
then
  STATUS="${STATUS}  ${OK_ICON}  ${TURN_FQDN} is UP.\n"
else
  STATUS="${STATUS}  ${NOTOK_ICON}  ${TURN_FQDN} is ${FG_RED}DOWN${RESET_COLORS}.\n"
fi
DISK_USAGE=`ssh "${USER}@${TURN_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}   ${NOTOK_ICON}  ${TURN_FQDN}  disk usage is ${FG_RED}${DISK_USAGE}%%  ${RESET_COLORS}\n"
fi


# Check Asterisk
if ssh "${USER}@${ASTERISK_FQDN}" sudo systemctl status asterisk
then
  STATUS="${STATUS}  ${OK_ICON}  ${ASTERISK_FQDN} is UP.\n"
else
  STATUS="${STATUS}  ${NOTOK_ICON}  ${ASTERISK_FQDN} is ${FG_RED}DOWN${RESET_COLORS}\n"
fi
DISK_USAGE=`ssh "${USER}@${ASTERISK_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${NOTOK_ICON}  ${ASTERISK_FQDN} disk usage is ${FG_RED}${DISK_USAGE}%%  ${RESET_COLORS}\n"
fi

# Check REDIS
if ssh "${USER}@${REDIS_FQDN}" sudo systemctl status redis
then
  STATUS="${STATUS}  ${OK_ICON}  REDIS is UP.\n"
else
  STATUS="${STATUS}  ${NOTOK_ICON}  REDIS is ${FG_RED}DOWN${RESET_COLORS}\n"
fi
DISK_USAGE=`ssh "${USER}@${REDIS_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${NOTOK_ICON}  REDIS disk usage is ${FG_RED}${DISK_USAGE}%%  ${RESET_COLORS}\n"
fi

# Check NGINX
if ssh "${USER}@${NGINX_FQDN}" sudo systemctl status nginx
then
  STATUS="${STATUS}  ${OK_ICON}  NGINX is UP.\n"
else
  STATUS="${STATUS}  ${NOTOK_ICON}  NGINX is ${FG_RED}DOWN${RESET_COLORS}\n"
fi
DISK_USAGE=`ssh "${USER}@${NGINX_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${NOTOK_ICON}  ${NGINX_FQDN} disk usage is ${FG_RED}${DISK_USAGE}%%  ${RESET_COLORS}\n"
fi

OPENAM_STATUS=`curl -I  -k https://localhost/${OPENAM_PATH}/XUI | head -n 1|cut -d$' ' -f2`
if [[ "$OPENAM_STATUS" != "302" ]]
then
  echo "ERROR!"
  STATUS="${STATUS}  ${NOTOK_ICON}  openam status: ${FG}${OPENAM_STATUS}${RESET_COLORS}\n" 
else
  STATUS="${STATUS}  ${OK_ICON}  openam status: ${OPENAM_STATUS}\n" 
fi

# Check KMS
nm="kms"
if ssh "${USER}@${KURENTO_FQDN}" sudo systemctl status kurento-media-server
then
  STATUS="${STATUS}  ${OK_ICON}  ${KURENTO_FQDN} is UP.\n"
else
  STATUS="${STATUS}  ${NOTOK_ICON}  ${KURENTO_FQDN} is ${FG_RED}DOWN${RESET_COLORS}\n"
fi
DISK_USAGE=`ssh "${USER}@${KURENTO_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${NOTOK_ICON}  ${KURENTO_FQDN} disk usage is ${FG_RED}${DISK_USAGE}%%  ${RESET_COLORS}\n"
fi


STATUS="${STATUS}\n***************************************************\n\n"

clear
echo ""
printf "${STATUS}"
echo ""
