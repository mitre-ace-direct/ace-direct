#!/bin/bash

RS='\u001b[0m'
FG_RED='\u001b[31m'
OK_ICON='✅'
NOTOK_ICON='❌'
Q='🤔 '

USERNAME=""
FNAME=""
LNAME=""
ROLE=""
PHONE=""
EMAIL=""
ORG=""
EXT=""
QUEUE1=""
QUEUE2=""
PASSWORD=""
TEMP_RESPONSE=""
INTERACTIVE="false"
AROLE="AD Agent"
MROLE="Manager"

getInput() {
  TEMP_RESPONSE=""
  VAL=`echo $1 | sed 's/ *$//g'`
  PROMPT=$2
  DEFAULT=""
  DEFAULT_STR=""
  if [ "$#" -eq 3 ]; then
    DEFAULT=$3
    DEFAULT_STR=" [$3] "
  fi
  while true
  do
    if [ ! -z "$VAL" ]; then
      TEMP_RESPONSE=$VAL
      return 0
    fi
    read -p "${Q}${PROMPT}${DEFAULT_STR}: " -r
    VAL=`echo ${REPLY} | sed 's/ *$//g'`
    if [ -z "$VAL" ]; then
      if [ "$#" -eq 3 ]; then
        VAL=$DEFAULT
      fi
    fi
  done
}

getPasswordInput() {
  TEMP_RESPONSE=""
  VAL=`echo $1 | sed 's/ *$//g'`
  PROMPT=$2
  while true
  do
    if [ ! -z "$VAL" ]; then
      TEMP_RESPONSE=$VAL
      echo ""
      return 0
    fi
    printf "\n"
    read -p "${Q}${PROMPT}: " -rs
    VAL1=`echo ${REPLY} | sed 's/ *$//g'`
    printf "\n"
    read -p "${Q}Re-enter: " -rs
    VAL2=`echo ${REPLY} | sed 's/ *$//g'`
    VAL=""
    if [ "$VAL1" == "$VAL2" ]; then
      VAL=${VAL1}  
    fi
  done
}

usage() {
  printf "\nusage:  $0 -u <username> [-p <password>] [-f <first name>] [-l <last name>] [-r <${AROLE}|${MROLE}>] [-n <phone>] [-e <email>] [-o <organization>] [-x <extension>] [-y <queue1>] [-z <queue2>] [-i]\n\n"
  printf "  e.g.  $0 -i  # interactive mode\n\n"
  printf "  e.g.  $0 -u dagent1 -p somepassword -f Alice -l Jones -r \"${AROLE}\" -n 888-888-8888 -e dagent1@mail.com -o \"The Org\" -x 33001 -y ComplaintsQueue -z GeneralQuestionsQueue\n\n"
  printf "  e.g.  $0 -u manager -p somepassword -f Mary -l Smith -r \"${MROLE}\" -n 111-111-1111 -e manager@mail.com -o \"That Org\"\n\n"
  exit 1;
}

while getopts "u:p:f:l:r:n:e:o:x:y:z:i" arg; do
  case "${arg}" in
    u)
      USERNAME=${OPTARG}
      ;;
    p)
      PASSWORD=${OPTARG}
      ;;          
    f)
      FNAME=${OPTARG}
      ;;
    l)
      LNAME=${OPTARG}
      ;;
    r)
      ROLE=${OPTARG}
      ;;                  
    n)
      PHONE=${OPTARG}
      ;;                  
    e)
      EMAIL=${OPTARG}
      ;;                  
    o)
      ORG=${OPTARG}
      ;;                  
    x)
      EXT=${OPTARG}
      ;;                  
    y)
      QUEUE1=${OPTARG}
      ;;                  
    z)
      QUEUE2=${OPTARG}
      ;;                  
    i)
      # interactive mode
      INTERACTIVE="true"
      ;;                  
    *)
      usage
      ;;
  esac
done
shift $((OPTIND-1))

# if no args and not interactive mode, show usage
if [ "$#" -eq 0 ]; then
  if [ "$INTERACTIVE" == "false" ]; then
    usage
    exit 0
  fi
fi

echo ""

getInput " $USERNAME " 'Enter a username' 'dagent1'
USERNAME=$TEMP_RESPONSE

getInput " $FNAME " 'Enter a first name' 'Alice'
FNAME=$TEMP_RESPONSE

getInput " $LNAME " 'Enter a last name' 'Jones'
LNAME=$TEMP_RESPONSE

getInput " $ROLE " "Enter a role (${AROLE}|${MROLE})"
ROLE=$TEMP_RESPONSE
if [ "$ROLE" != "$AROLE" -a "$ROLE" != "$MROLE" ]
then
  echo "*** invalid role ***"
  exit 99
fi

getInput " $PHONE " 'Enter a phone' '111-222-3333'
PHONE=$TEMP_RESPONSE

getInput " $EMAIL " 'Enter an email' 'dagent1@mail.com'
EMAIL=$TEMP_RESPONSE

getInput " $ORG " 'Enter an organization' 'ABC Org.'
ORG=$TEMP_RESPONSE

if [ "$ROLE" == "$AROLE" ]; then
  getInput " $EXT " 'Enter an extension' '33001'
  EXT=$TEMP_RESPONSE

  getInput " $QUEUE1 " 'Enter a queue1' 'ComplaintsQueue'
  QUEUE1=$TEMP_RESPONSE

  getInput " $QUEUE2 " 'Enter a queue2' 'GeneralQuestionsQueue'
  QUEUE2=$TEMP_RESPONSE
fi

getPasswordInput " $PASSWORD " 'Enter a password'
PASSWORD=$TEMP_RESPONSE

if [ "$INTERACTIVE" == "true" ]; then
  echo ""
  echo "Values:"
  echo ""
  echo "  ${USERNAME}"
  echo "  ${FNAME}"
  echo "  ${LNAME}"
  echo "  ${ROLE}"
  echo "  ${PHONE}"
  echo "  ${EMAIL}"
  echo "  ${ORG}"
  if [ "$ROLE" == "$AROLE" ]; then
    echo "  ${EXT}"
    echo "  ${QUEUE1}"
    echo "  ${QUEUE2}"
  fi
  echo "  (hidden)"
  echo ""

  read -p "${Q}OK to continue (y/n)? " -n 1 -r
  printf "\n"
  if [[ $REPLY =~ ^[Yy]$ ]]
  then
    printf "\n"
  else
    printf "Aborting... \n\n"
    exit 1
  fi
fi

# add to MySQL
THEARG=""
if [ "$ROLE" == "$AROLE" ]; then
  # add agent
  THEARG='{"username":"'${USERNAME}'", "first_name":"'${FNAME}'", "last_name":"'${LNAME}'", "role":"'${ROLE}'", "phone":"'${PHONE}'", "email":"'${EMAIL}'", "organization":"'${ORG}'", "extension":'${EXT}', "queue1":"'${QUEUE1}'", "queue2":"'${QUEUE2}'"}'
else
  # add manager
  THEARG='{"username":"'${USERNAME}'", "first_name":"'${FNAME}'", "last_name":"'${LNAME}'", "role":"'${ROLE}'", "phone":"'${PHONE}'", "email":"'${EMAIL}'", "organization":"'${ORG}'"}'
fi
if node create-user-mysql.js "${THEARG}"; then
  # add to fognito
  if node create-user-fognito.js ${USERNAME} ${PASSWORD} "${ROLE}" ${EMAIL}  "${FNAME} ${LNAME}"; then
    printf "success.\n\n"
  else
    printf "error adding to fognito.\n\n"
    exit 99
  fi
else
  printf "error adding to mysql.\n\n"
  exit 99
fi

exit 0
