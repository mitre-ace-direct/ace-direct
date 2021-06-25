#!/bin/bash

echo "Checking servers..."

STATUS="\n*******************************************\nSERVER STATUS:\n"

STUN_FQDN=`grep "stun_fqdn" dat/config.json|awk -F':' '{ print $2 }'|sed 's/"//g'|sed 's/,//g'|sed 's/ //g'`
TURN_FQDN=`grep "turn_fqdn" dat/config.json|awk -F':' '{ print $2 }'|sed 's/"//g'|sed 's/,//g'|sed 's/ //g'`
KURENTO_FQDN=`grep "kurento_fqdn" dat/config.json|awk -F':' '{ print $2 }'|sed 's/"//g'|sed 's/,//g'|sed 's/ //g'`
ASTERISK_FQDN=`grep "asterisk_fqdn" dat/config.json|awk -F':' '{ print $2 }'|sed 's/"//g'|sed 's/,//g'|sed 's/ //g'`


# Check STUN
if ssh "${USER}@${STUN_FQDN}" sudo netstat -tnlp | grep 3478
then
  STATUS="${STATUS}  ${STUN_FQDN} is UP.\n"
else
  STATUS="${STATUS}  ${STUN_FQDN} is DOWN.\n"
fi
DISK_USAGE=`ssh "${USER}@${STUN_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${STUN_FQDN}  disk usage is ${DISK_USAGE}%% !!     WARNING!!!\n"
fi

# Check TURN 
if ssh "${USER}@${TURN_FQDN}" sudo netstat -tnlp | grep 3478
then
  STATUS="${STATUS}  ${TURN_FQDN} is UP.\n"
else
  STATUS="${STATUS}  ${TURN_FQDN} is DOWN.\n"
fi
DISK_USAGE=`ssh "${USER}@${TURN_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${TURN_FQDN}  disk usage is ${DISK_USAGE}%% !!     WARNING!!!\n"
fi


# Check Asterisk
if ssh "${USER}@${ASTERISK_FQDN}" sudo systemctl status asterisk
then
  STATUS="${STATUS}  ${ASTERISK_FQDN} is UP.\n"
else
  STATUS="${STATUS}  ${ASTERISK_FQDN} is DOWN.\n"
fi
DISK_USAGE=`ssh "${USER}@${ASTERISK_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${ASTERISK_FQDN} disk usage is ${DISK_USAGE}%% !!     WARNING!!!\n"
fi


# Check KMS
nm="kms"
if ssh "${USER}@${KURENTO_FQDN}" sudo systemctl status kurento-media-server
then
  STATUS="${STATUS}  ${KURENTO_FQDN} is UP.\n"
else
  STATUS="${STATUS}  ${KURENTO_FQDN} is DOWN.\n"
fi
DISK_USAGE=`ssh "${USER}@${KURENTO_FQDN}" df -k --output='pcent' / | tail -1 | sed -e 's/%//g'`
if (( $DISK_USAGE > 95 )); then
  STATUS="${STATUS}  ${KURENTO_FQDN} disk usage is ${DISK_USAGE}%% !!     WARNING!!!\n"
fi


STATUS="${STATUS}*******************************************\n\n"

clear
echo ""
printf "${STATUS}"
echo ""
