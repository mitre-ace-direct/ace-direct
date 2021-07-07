#!/bin/bash

echo "Checking servers..."

STATUS="\n***************************************************\n\n  ACE DIRECT SERVER STATUS:\n\n"

CONFIG="dat/config.json"
STUN_FQDN=`node ./acedirect/tools/parseJson.js servers:stun_fqdn ${CONFIG}`
TURN_FQDN=`node ./acedirect/tools/parseJson.js servers:turn_fqdn ${CONFIG}`
KURENTO_FQDN=`node ./acedirect/tools/parseJson.js servers:kurento_fqdn ${CONFIG}`
ASTERISK_FQDN=`node ./acedirect/tools/parseJson.js servers:asterisk_fqdn ${CONFIG}`
MAIN_FQDN=`node ./acedirect/tools/parseJson.js servers:main_fqdn ${CONFIG}`
REDIS_FQDN=`node ./acedirect/tools/parseJson.js servers:redis_fqdn ${CONFIG}`
NGINX_FQDN=`node ./acedirect/tools/parseJson.js servers:nginx_fqdn ${CONFIG}`
OPENAM_PATH=`node ./acedirect/tools/parseJson.js openam:path ${CONFIG}`
MYSQL_FQDN=`node ./acedirect/tools/parseJson.js servers:mysql_fqdn ${CONFIG}`
MYSQL_USER=`node ./acedirect/tools/parseJson.js database_servers:mysql:user ${CONFIG}`
MYSQL_PASS=`node ./acedirect/tools/parseJson.js database_servers:mysql:password ${CONFIG}`
MYSQL_DB=`node ./acedirect/tools/parseJson.js database_servers:mysql:ad_database_name ${CONFIG}`
MONGO_FQDN=`node ./acedirect/tools/parseJson.js servers:mongodb_fqdn ${CONFIG}`
MONGO_PORT=`node ./acedirect/tools/parseJson.js app_ports:mongodb ${CONFIG}`
CERT=`node ./acedirect/tools/parseJson.js common:https:certificate ${CONFIG}`

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
  STATUS="${STATUS}  ${NOTOK_ICON}  ${MAIN_FQDN} disk usage is ${FG_RED}${DISK_USAGE}%%  ${RESET_COLORS}\n"
else
  STATUS="${STATUS}  ${OK_ICON}  ${MAIN_FQDN} disk usage is ${DISK_USAGE}%%\n"
fi

# Check STUN
if ssh "${USER}@${STUN_FQDN}" sudo netstat -tnlp | grep 3478
then
  STATUS="${STATUS}  ${OK_ICON}  ${STUN_FQDN} is UP\n"
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
  STATUS="${STATUS}  ${OK_ICON}  ${TURN_FQDN} is UP\n"
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
  STATUS="${STATUS}  ${OK_ICON}  ${ASTERISK_FQDN} is UP\n"
else
  STATUS="${STATUS}  ${NOTOK_ICON}  ${ASTERISK_FQDN} is ${FG_RED}DOWN${RESET_COLORS}\n"
fi
DISK_USAGE=`ssh "${USER}@${ASTERISK_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${NOTOK_ICON}  ${ASTERISK_FQDN} disk usage is ${FG_RED}${DISK_USAGE}%%  ${RESET_COLORS}\n"
fi

# Check Asterisk AMI
if node ./acedirect/tools/pingAsterisk.js ${CONFIG}
then
  STATUS="${STATUS}  ${OK_ICON}  ASTERISK_AMI success!\n"
else
  STATUS="${STATUS}  ${NOTOK_ICON}  ASTERISK_AMI ${FG_RED}FAILED!${RESET_COLORS}\n"
fi

# Check REDIS
if ssh "${USER}@${REDIS_FQDN}" sudo systemctl status redis
then
  STATUS="${STATUS}  ${OK_ICON}  REDIS is UP\n"
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
  STATUS="${STATUS}  ${OK_ICON}  NGINX is UP\n"
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
  STATUS="${STATUS}  ${NOTOK_ICON}  openam HTTP status: ${FG}${OPENAM_STATUS}${RESET_COLORS}\n" 
else
  STATUS="${STATUS}  ${OK_ICON}  openam HTTP status: ${OPENAM_STATUS}\n" 
fi

# Check KMS
if ssh "${USER}@${KURENTO_FQDN}" sudo systemctl status kurento-media-server
then
  STATUS="${STATUS}  ${OK_ICON}  ${KURENTO_FQDN} is UP\n"
else
  STATUS="${STATUS}  ${NOTOK_ICON}  ${KURENTO_FQDN} is ${FG_RED}DOWN${RESET_COLORS}\n"
fi
DISK_USAGE=`ssh "${USER}@${KURENTO_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${NOTOK_ICON}  ${KURENTO_FQDN} disk usage is ${FG_RED}${DISK_USAGE}%%  ${RESET_COLORS}\n"
fi

# MySQL check
MYSQL_RC=`node ./acedirect/tools/checkMysql.js ${MYSQL_FQDN} ${MYSQL_USER} ${MYSQL_PASS} ${MYSQL_DB}` 
if [[ "$MYSQL_RC" != "0" ]] 
then
  echo "ERROR!"
  STATUS="${STATUS}  ${NOTOK_ICON}  mysql: ${FG}${MYSQL_RC}${RESET_COLORS}\n" 
else
  STATUS="${STATUS}  ${OK_ICON}  mysql status: ${MYSQL_RC}\n" 
fi

# Check MongoDB
if mongo --eval 'db.runCommand("ping").ok' ${MONGO_FQDN}:${MONGO_PORT} --quiet
then
  STATUS="${STATUS}  ${OK_ICON}  mongo is UP\n"
else
  STATUS="${STATUS}  ${NOTOK_ICON}  mongo is ${FG_RED}DOWN${RESET_COLORS}\n"
fi

# Check certs
if openssl x509 -checkend 86400 -noout -in ${CERT}
then
  STATUS="${STATUS}  ${OK_ICON}  local ${CERT} cert is good\n"
else
  STATUS="${STATUS}  ${NOTOK_ICON}  local ${CERT} cert is ${FG_RED}is expired or will expire tomorrow${RESET_COLORS}\n"
fi


# DONE
STATUS="${STATUS}\n***************************************************\n\n"

clear
echo ""
printf "${STATUS}"
echo ""
