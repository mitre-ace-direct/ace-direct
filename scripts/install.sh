#!/bin/bash

printf "\nACE DIRECT INSTALLATION SCRIPT\n\n"
printf "Note: You must fully edit the dat/config.json configuration before running this script!\n\n"

read -p "DO YOU WISH TO CONTINUE (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then
  printf "Installing ACE Direct components...\n"
else
  printf "ABORTING...\n\n"
  exit 1
fi

# Check config file
printf "Checking dat/config.json...\n"
CONFIG="dat/config.json"
printf "${IND}${CONFIG}... "
if jsonlint ${CONFIG} >/dev/null 2>&1
then
  printf "${FR} ${OK_ICON}\n\n"
else
  CONFIG_ERROR=`jsonlint ${CONFIG} 2>&1 | head -n1`
  printf " ${FG_RED}is malformed! ${CONFIG_ERROR}${RS}${FR} ${NOTOK_ICON}\n"
  PASSED=false
  printf "${IND}Aborting status check...\n\n"
  printf "\n\n"
  exit 99
fi

# TODO
exit

# Install NGINX
read -p "Install NGINX (y/n)? " -n 1 -r
printf "\n"
if [[ $REPLY =~ ^[Yy]$ ]]
then

fi

