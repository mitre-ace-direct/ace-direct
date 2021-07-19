#!/bin/bash

OPENAM_FQDN=""
ACEDIRECT_FQDN=""
ADUSER=""

usage() { echo "Usage: $0 [-u <ACE Direct user>] [-o <OpenAM FQDN>] [-a <ACE Direct FQDN>]" 1>&2; exit 1; }
while getopts ":u:o:a:" arg; do
  case "${arg}" in
    u)
      ADUSER=${OPTARG}
      ;;
    o)
      OPENAM_FQDN=${OPTARG}
      ;;
    a)
      ACEDIRECT_FQDN=${OPTARG}
      ;;      
    *)
      usage
      ;;
  esac
done
shift $((OPTIND-1))

if [ -z "${ADUSER}" ] || [ -z "${OPENAM_FQDN}" ] || [ -z "${ACEDIRECT_FQDN}" ]; then
    printf "\n"
    usage
    printf "\n"
    exit
fi

printf "Using params:\n"
printf "ADUSER=${ADUSER}\n"
printf "OPENAM_FQDN=${OPENAM_FQDN}\n"
printf "ACEDIRECT_FQDN=${ACEDIRECT_FQDN}\n"
printf "\n"

sudo service nginx stop >/dev/null 2>&1

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

TMP1=/tmp/`date +%s`_${SOMEUSER}_file1.txt
TMP2=/tmp/`date +%s`_${SOMEUSER}_file2.txt
TMP3=/tmp/`date +%s`_${SOMEUSER}_file3.txt
sudo cat /etc/nginx/nginx.conf | sed -e "s/SOMEUSER/${SOMEUSER}/g" > $TMP1
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

printf "done.\n\n"