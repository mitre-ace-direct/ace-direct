#!/bin/bash

CONFIG="../dat/config.json"
RS='\u001b[0m'
FG_RED='\u001b[31m'
FR="\033[1000D"
OK_ICON='✅'
NOTOK_ICON='❌'

read -p "Install NGINX (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
  npm install -g jsonlint  >/dev/null # make sure jsonlint is there

  # Check config file
  if jsonlint ${CONFIG} >/dev/null 2>&1
  then
    printf "${FR} ${OK_ICON}\n\n"
  else
    CONFIG_ERROR=`jsonlint ${CONFIG} 2>&1 | head -n1`
    printf " ${FG_RED}is malformed! ${CONFIG_ERROR}${RS}${FR} ${NOTOK_ICON}\n"
    PASSED=false
    printf "Aborting...\n\n"
    printf "\n\n"
    exit 99
  fi

  OPENAM_FQDN=`node ../acedirect/tools/parseJson.js servers:main_fqdn ${CONFIG}` # OpenAM lives on Node server
  ACEDIRECT_FQDN=`node ../acedirect/tools/parseJson.js servers:main_fqdn ${CONFIG}`

  printf "\n"
  printf "Using SOMEUSER value: ${USER}...\n"
  printf "Using default port numbers...\n"
  printf "Using OPENAM_FQDN: ${OPENAM_FQDN}...\n"
  printf "Using ACEDIRECT_FQDN: ${ACEDIRECT_FQDN}...\n\n"

  printf "Installing NGINX...\n"
  sudo yum install epel-release
  sudo yum install nginx
  sudo systemctl start nginx  # start
  pidof nginx  # make sure it is running
  sudo systemctl enable nginx  # start on reboot
  sudo mkdir -p /etc/nginx/html
  sudo mkdir -p /etc/nginx/images

  # configure NGINX
  sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf_original >/dev/null 2>&1
  sudo cp nginx.conf /etc/nginx/nginx.conf
  sudo cp html/* /etc/nginx/html
  sudo cp images/* /etc/nginx/images

  TMP1=/tmp/`date +%s`_${USER}_file1.txt
  TMP2=/tmp/`date +%s`_${USER}_file2.txt
  TMP3=/tmp/`date +%s`_${USER}_file3.txt
  sudo cat /etc/nginx/nginx.conf | sed -e "s/SOMEUSER/${USER}/g" > $TMP1
  sudo cat $TMP1 | sed -e "s/<OPENAM_FQDN>/${OPENAM_FQDN}/g" > $TMP2
  sudo cat $TMP2 | sed -e "s/<ACE_DIRECT_FQDN>/${ACEDIRECT_FQDN}/g" > $TMP3
  sudo cp $TMP3 /etc/nginx/nginx.conf
  rm $TMP1 $TMP2 $TMP3

  # restart NGINX
  sudo service nginx stop
  sudo service nginx start
  sudo service nginx restart  # another way
  sudo service nginx status
  pidof nginx
else
  printf "Aborting NGINX installation...\n"
  exit 1
fi
