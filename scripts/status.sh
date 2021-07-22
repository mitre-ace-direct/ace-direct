#!/bin/bash

RS='\u001b[0m'
FG_RED='\u001b[31m'
IND="     "
FR="\033[1000D"
OK_ICON='✅'
NOTOK_ICON='❌'
PASSED=true

printf "${RS}ACE DIRECT SELF-TEST:\n\n"
CONFIG="dat/config.json"
printf "${IND}${CONFIG}... "
# Check config file
if jsonlint ${CONFIG} >/dev/null 2>&1
then
  printf "${FR} ${OK_ICON}\n"
else
  CONFIG_ERROR=`jsonlint ${CONFIG} 2>&1 | head -n1`
  printf " ${FG_RED}is malformed! ${CONFIG_ERROR}${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
  printf "${IND}Aborting status check...\n\n"
  printf "\n\n"
  exit 99
fi

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
PM2_NAMES=( $(pm2 prettylist | grep "      name:" | awk -F  "'"  '{ print $2 }' | sed 's/ /_/g') )
AD_PATH=`node ./acedirect/tools/parseJson.js nginx:ad_path ${CONFIG}`
MP_PATH=`node ./acedirect/tools/parseJson.js nginx:mp_path ${CONFIG}`
AG_ROUTE=`node ./acedirect/tools/parseJson.js nginx:agent_route ${CONFIG}`
CO_ROUTE=`node ./acedirect/tools/parseJson.js nginx:consumer_route ${CONFIG}`

URL_AGENT="https://localhost${AD_PATH}${AG_ROUTE}"
URL_CONSUMER="https://localhost${AD_PATH}${CO_ROUTE}"
URL_MANAGER="https://localhost${MP_PATH}"

for ((i = 0; i < 8; ++i)); do
  printf "${IND}pm2 ${i} ${PM2_NAMES[i]}... " 
  PM2_STATUS=`pm2 show ${i} | grep status | awk '{ print $4 }' | sed 's/ //g'`
  if [[ "$PM2_STATUS" != "online" ]]
  then
    printf " ${FG_RED}${PM2_STATUS}${RS}${FR} ${NOTOK_ICON}\n" 
    PASSED=false
  else
    printf "${FR} ${OK_ICON}\n"
  fi
done

printf "${IND}main server disk usage ${MAIN_FQDN}..."
# Check MAIN
DISK_USAGE=`ssh "${USER}@${MAIN_FQDN}" df -k --output='pcent' / 2>/dev/null | tail -1 | sed -e 's/%//g'`
if [ -z "${DISK_USAGE}" ]
then
  printf " ${FG_RED}unable to get disk usage${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
else
  if (( $DISK_USAGE > 95 )); then
    printf "   ${FG_RED}${DISK_USAGE}%%${RS}${FR} ${NOTOK_ICON}\n"
    PASSED=false
  else
    printf " ${DISK_USAGE}%%${FR} ${OK_ICON}\n"
  fi
fi

# Check STUN
printf "${IND}stun server ${STUN_FQDN}..."
STUN_RET=`ssh "${USER}@${STUN_FQDN}" sudo netstat -tnlp  2>/dev/null  | grep 3478`
if [ -z "${STUN_RET}" ]
then
  printf "   ${FG_RED}service is down or unreachable${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
else
  printf "${FR} ${OK_ICON}\n"
fi
printf "${IND}stun disk usage ${STUN_FQDN}..."
DISK_USAGE=`ssh "${USER}@${STUN_FQDN}" df -k --output='pcent' / 2>/dev/null  | tail -1 | sed -e 's/%//g'`
if [ -z "${DISK_USAGE}" ]
then
  printf "   ${FG_RED}unable to get disk usage${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
else
  if (( $DISK_USAGE > 95 )); then
    printf "   ${FG_RED}${DISK_USAGE}%%  ${RS}${FR} ${NOTOK_ICON}\n"
    PASSED=false
  else
    printf " ${DISK_USAGE}%%${FR} ${OK_ICON}\n"
  fi
fi

# Check TURN 
printf "${IND}turn server ${TURN_FQDN}..."
TURN_RET=`ssh "${USER}@${TURN_FQDN}" sudo netstat -tnlp 2>/dev/null  | grep 3478`
if [ -z "${TURN_RET}" ]
then
  printf "   ${FG_RED}service is down or unreachable${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
else
  printf "${FR} ${OK_ICON}\n"
fi

printf "${IND}turn server disk usage ${TURN_FQDN}..."
DISK_USAGE=`ssh "${USER}@${TURN_FQDN}" df -k --output='pcent' / 2>/dev/null  | tail -1 | sed -e 's/%//g'`
if [ -z "${DISK_USAGE}" ]
then
  printf "   ${FG_RED}unable to get disk usage${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
else
  if (( $DISK_USAGE > 95 )); then
     printf "   ${FG_RED}${DISK_USAGE}%% ${RS}${FR} ${NOTOK_ICON}\n"
     PASSED=false
  else
    printf " ${DISK_USAGE}%%${FR} ${OK_ICON}\n"
  fi
fi

# Check Asterisk
printf "${IND}asterisk server ${ASTERISK_FQDN}..."
if ssh "${USER}@${ASTERISK_FQDN}" sudo systemctl status asterisk  >/dev/null 2>&1
then
  printf "${FR} ${OK_ICON}\n"
else
  printf "   ${FG_RED}service is down or unreachable${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
fi
printf "${IND}asterisk server disk usage ${ASTERISK_FQDN}..."
DISK_USAGE=`ssh "${USER}@${ASTERISK_FQDN}" df -k --output='pcent' / 2>/dev/null  | tail -1 | sed -e 's/%//g'`
if [ -z "${DISK_USAGE}" ]
then
  printf "   ${FG_RED}unable to get disk usage${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
else
  if (( $DISK_USAGE > 95 )); then
    printf "   ${FG_RED}${DISK_USAGE}%%  ${RS}${FR} ${NOTOK_ICON}\n"
    PASSED=false
  else
    printf " ${DISK_USAGE}%%${FR} ${OK_ICON}\n"
  fi
fi

# Check Asterisk AMI
printf "${IND}asterisk AMI ${ASTERISK_FQDN}..."
if node ./acedirect/tools/pingAsterisk.js >/dev/null 2>&1 ${CONFIG}
then
  printf "${FR} ${OK_ICON}\n"
else
  printf "   ${FG_RED}failed${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
fi

# Check REDIS
printf "${IND}redis server ${REDIS_FQDN}..."
if ssh "${USER}@${REDIS_FQDN}" sudo systemctl status redis >/dev/null 2>&1
then
  printf "${FR} ${OK_ICON}\n"
else
  printf "   ${FG_RED}service is down or unreachable${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
fi
printf "${IND}redis server disk space ${REDIS_FQDN}..."
DISK_USAGE=`ssh "${USER}@${REDIS_FQDN}" df -k --output='pcent' / 2>/dev/null  | tail -1 | sed -e 's/%//g'`
if [ -z "${DISK_USAGE}" ]
then
  printf "   ${FG_RED}unable to get disk usage${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
else
  if (( $DISK_USAGE > 95 )); then
    printf "   ${FG_RED}${DISK_USAGE}%%  ${RS}${FR} ${NOTOK_ICON}\n"
    PASSED=false
  else
    printf " ${DISK_USAGE}%%${FR} ${OK_ICON}\n"
  fi
fi

# Check NGINX
printf "${IND}nginx server ${NGINX_FQDN}..."
if ssh "${USER}@${NGINX_FQDN}" sudo systemctl status nginx  >/dev/null 2>&1
then
  printf "${FR} ${OK_ICON}\n"
else
  printf "   ${FG_RED}service is down or unreachable${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
fi
printf "${IND}nginx server disk usage ${NGINX_FQDN}..."
DISK_USAGE=`ssh "${USER}@${NGINX_FQDN}" df -k --output='pcent' / 2>/dev/null  | tail -1 | sed -e 's/%//g'`
if [ -z "${DISK_USAGE}" ]
then
  printf "   ${FG_RED}unable to get disk usage${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
else
  if (( $DISK_USAGE > 95 )); then
    printf "   ${FG_RED}${DISK_USAGE}%%  ${RS}${FR} ${NOTOK_ICON}\n"
    PASSED=false
  else
    printf " ${DISK_USAGE}%%${FR} ${OK_ICON}\n"
  fi
fi

printf "${IND}openam server ${OPENAM_PATH}..."
OPENAM_STATUS=`curl -I  -k https://localhost/${OPENAM_PATH}/XUI 2>/dev/null  | head -n 1|cut -d$' ' -f2`
if [[ "$OPENAM_STATUS" != "302" ]]
then
  printf "  ${FG_RED}HTTP status: ${OPENAM_STATUS}${RS}${FR} ${NOTOK_ICON}\n" 
  PASSED=false
else
  printf "${FR} ${OK_ICON}\n" 
fi

printf "${IND}Agent URL ${URL_AGENT}..."
URL_STATUS=`curl -I  -k ${URL_AGENT} 2>/dev/null  | head -n 1|cut -d$' ' -f2`
if [ "$URL_STATUS" != "200" ] && [ "$URL_STATUS" != "301" ] && [ "$URL_STATUS" != "302" ];
then
  printf "  ${FG_RED}HTTP status: ${URL_STATUS}${RS}${FR} ${NOTOK_ICON}\n" 
  PASSED=false
else
  printf "${FR} ${OK_ICON}\n" 
fi

printf "${IND}Consumer URL ${URL_CONSUMER}..."
URL_STATUS=`curl -I  -k ${URL_CONSUMER} 2>/dev/null  | head -n 1|cut -d$' ' -f2`
if [ "$URL_STATUS" != "200" ] && [ "$URL_STATUS" != "301" ] && [ "$URL_STATUS" != "302" ];
then
  printf "  ${FG_RED}HTTP status: ${URL_STATUS}${RS}${FR} ${NOTOK_ICON}\n" 
  PASSED=false
else
  printf "${FR} ${OK_ICON}\n" 
fi

printf "${IND}Manager URL ${URL_MANAGER}..."
URL_STATUS=`curl -I  -k ${URL_MANAGER} 2>/dev/null  | head -n 1|cut -d$' ' -f2`
if [ "$URL_STATUS" != "200" ] && [ "$URL_STATUS" != "301" ] && [ "$URL_STATUS" != "302" ];
then
  printf "  ${FG_RED}HTTP status: ${URL_STATUS}${RS}${FR} ${NOTOK_ICON}\n" 
  PASSED=false
else
  printf "${FR} ${OK_ICON}\n" 
fi

# Check KMS
printf "${IND}kms server ${KURENTO_FQDN}..."
if ssh "${USER}@${KURENTO_FQDN}" sudo systemctl status kurento-media-server  >/dev/null 2>&1
then
  printf "${FR} ${OK_ICON}\n"
else
  printf "   ${FG_RED}service is down or unreachable${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
fi
printf "${IND}kms server disk usage ${KURENTO_FQDN}..."
DISK_USAGE=`ssh "${USER}@${KURENTO_FQDN}" df -k --output='pcent' / 2>/dev/null  | tail -1 | sed -e 's/%//g'`
if [ -z "${DISK_USAGE}" ]
then
  printf "   ${FG_RED}unable to get disk usage${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
else
  if (( $DISK_USAGE > 95 )); then
    printf "   ${FG_RED}${DISK_USAGE}%%  ${RS}${FR} ${NOTOK_ICON}\n"
    PASSED=false
  else
    printf " ${DISK_USAGE}%%${FR} ${OK_ICON}\n"
  fi
fi

# MySQL check
printf "${IND}mysql server ${MYSQL_FQDN}..."
MYSQL_RC=`node ./acedirect/tools/checkMysql.js ${MYSQL_FQDN} ${MYSQL_USER} ${MYSQL_PASS} ${MYSQL_DB}` 
if [[ "$MYSQL_RC" != "0" ]] 
then
  printf "   ${FG_RED}rc = ${MYSQL_RC}${RS}${FR} ${NOTOK_ICON}\n" 
  PASSED=false
else
  printf "${FR} ${OK_ICON}\n" 
fi

# Check MongoDB
printf "${IND}mongo server ${MONGO_FQDN}..."
if mongo --eval 'db.runCommand("ping").ok' ${MONGO_FQDN}:${MONGO_PORT} --quiet >/dev/null 2>&1
then
  printf "${FR} ${OK_ICON}\n"
else
  printf "   ${FG_RED}service is down or unreachable${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
fi

# Check certs
printf "${IND}local certs ${CERT}..."
if openssl x509 -checkend 86400 -noout -in ${CERT} >/dev/null 2>&1
then
  printf "${FR} ${OK_ICON}\n"
else
  printf "   ${FG_RED}invalid, expiring soon, or not found${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
fi
printf "\n"
if ${PASSED}; then
   echo " 👍  All tests passed!"
else
   echo " 👎  ${FG_RED}Some tests failed!${RS}"
fi
printf "\n"


