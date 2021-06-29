#!/bin/bash

echo "Checking servers..."

STATUS="\n***************************************************\n\n  SERVER STATUS:\n\n"

STUN_FQDN=`grep "stun_fqdn" dat/config.json|awk -F':' '{ print $2 }'|sed 's/"//g'|sed 's/,//g'|sed 's/ //g'`
TURN_FQDN=`grep "turn_fqdn" dat/config.json|awk -F':' '{ print $2 }'|sed 's/"//g'|sed 's/,//g'|sed 's/ //g'`
KURENTO_FQDN=`grep "kurento_fqdn" dat/config.json|awk -F':' '{ print $2 }'|sed 's/"//g'|sed 's/,//g'|sed 's/ //g'`
ASTERISK_FQDN=`grep "asterisk_fqdn" dat/config.json|awk -F':' '{ print $2 }'|sed 's/"//g'|sed 's/,//g'|sed 's/ //g'`
MAIN_FQDN=`grep "main_fqdn" dat/config.json|awk -F':' '{ print $2 }'|sed 's/"//g'|sed 's/,//g'|sed 's/ //g'`
REDIS_FQDN=`grep "redis_fqdn" dat/config.json|awk -F':' '{ print $2 }'|sed 's/"//g'|sed 's/,//g'|sed 's/ //g'`
NGINX_FQDN=`grep "nginx_fqdn" dat/config.json|awk -F':' '{ print $2 }'|sed 's/"//g'|sed 's/,//g'|sed 's/ //g'`
RESET_COLORS='\u001b[0m'
FG_RED='\u001b[31m'


for ((i = 0; i < 7; ++i)); do
  PM2_STATUS=`pm2 show ${i} | grep status | awk '{ print $4 }' | sed 's/ //g'`
  FG=''
  if [[ "$PM2_STATUS" != "online" ]]
  then
    FG=${FG_RED}
  fi
  STATUS="${STATUS}  pm2 status ${i}: ${FG}${PM2_STATUS}${RESET_COLORS}\n" 
done


# Check MAIN
DISK_USAGE=`ssh "${USER}@${MAIN_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${MAIN_FQDN}  disk usage is ${FG_RED}${DISK_USAGE}%%  WARNING!${RESET_COLORS}\n"
else
  STATUS="${STATUS}  ${MAIN_FQDN}  disk usage is ${DISK_USAGE}%%.\n"
fi

# Check STUN
if ssh "${USER}@${STUN_FQDN}" sudo netstat -tnlp | grep 3478
then
  STATUS="${STATUS}  ${STUN_FQDN} is UP.\n"
else
  STATUS="${STATUS}  ${STUN_FQDN} is ${FG_RED}DOWN${RESET_COLORS}.\n"
fi
DISK_USAGE=`ssh "${USER}@${STUN_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${STUN_FQDN}  disk usage is ${FG_RED}${DISK_USAGE}%%  WARNING!${RESET_COLORS}\n"
fi

# Check TURN 
if ssh "${USER}@${TURN_FQDN}" sudo netstat -tnlp | grep 3478
then
  STATUS="${STATUS}  ${TURN_FQDN} is UP.\n"
else
  STATUS="${STATUS}  ${TURN_FQDN} is ${FG_RED}DOWN${RESET_COLORS}.\n"
fi
DISK_USAGE=`ssh "${USER}@${TURN_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${TURN_FQDN}  disk usage is ${FG_RED}${DISK_USAGE}%%  WARNING!${RESET_COLORS}\n"
fi


# Check Asterisk
if ssh "${USER}@${ASTERISK_FQDN}" sudo systemctl status asterisk
then
  STATUS="${STATUS}  ${ASTERISK_FQDN} is UP.\n"
else
  STATUS="${STATUS}  ${ASTERISK_FQDN} is ${FG_RED}DOWN${RESET_COLORS}\n"
fi
DISK_USAGE=`ssh "${USER}@${ASTERISK_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${ASTERISK_FQDN} disk usage is ${FG_RED}${DISK_USAGE}%%  WARNING!${RESET_COLORS}\n"
fi

# Check REDIS
if ssh "${USER}@${REDIS_FQDN}" sudo systemctl status redis
then
  STATUS="${STATUS}  REDIS is UP.\n"
else
  STATUS="${STATUS}  REDIS is ${FG_RED}DOWN${RESET_COLORS}\n"
fi
DISK_USAGE=`ssh "${USER}@${REDIS_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  REDIS disk usage is ${FG_RED}${DISK_USAGE}%%  WARNING!${RESET_COLORS}\n"
fi

# Check NGINX
if ssh "${USER}@${NGINX_FQDN}" sudo systemctl status nginx
then
  STATUS="${STATUS}  NGINX is UP.\n"
else
  STATUS="${STATUS}  NGINX is ${FG_RED}DOWN${RESET_COLORS}\n"
fi
DISK_USAGE=`ssh "${USER}@${NGINX_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${NGINX_FQDN} disk usage is ${FG_RED}${DISK_USAGE}%%  WARNING!${RESET_COLORS}\n"
fi

# Check KMS
nm="kms"
if ssh "${USER}@${KURENTO_FQDN}" sudo systemctl status kurento-media-server
then
  STATUS="${STATUS}  ${KURENTO_FQDN} is UP.\n"
else
  STATUS="${STATUS}  ${KURENTO_FQDN} is ${FG_RED}DOWN${RESET_COLORS}\n"
fi
DISK_USAGE=`ssh "${USER}@${KURENTO_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${KURENTO_FQDN} disk usage is ${FG_RED}${DISK_USAGE}%%  WARNING!${RESET_COLORS}\n"
fi


STATUS="${STATUS}\n***************************************************\n\n"

clear
echo ""
printf "${STATUS}"
echo ""
