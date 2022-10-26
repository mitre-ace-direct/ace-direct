#!/bin/bash

ACEDIRECT_FQDN=""
ADUSER=""

usage() { printf "\nusage: \ncd ~/ace-direct/nginx\nsudo -E $0 -u <ACE Direct user account> -a <ACE Direct FQDN>\n\n" 1>&2; exit 1; }
while getopts ":u:a:" arg; do
  case "${arg}" in
    u)
      ADUSER=${OPTARG}
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

if [ -z "${ADUSER}" ] || [ -z "${ACEDIRECT_FQDN}" ]; then
  usage
fi

printf "\nUsing params:\n"
printf "ADUSER=${ADUSER}\n"
printf "ACEDIRECT_FQDN=${ACEDIRECT_FQDN}\n"
printf "\n"

sudo service nginx stop >/dev/null 2>&1

printf "Installing NGINX...\n"
sudo yum -y install epel-release
sudo yum -y install nginx
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

TMP1=/tmp/`date +%s`_${ADUSER}_file1.txt
TMP2=/tmp/`date +%s`_${ADUSER}_file2.txt
TMP3=/tmp/`date +%s`_${ADUSER}_file3.txt
sudo cat /etc/nginx/nginx.conf | sed -e "s/<SOMEUSER>/${ADUSER}/g" > $TMP1
sudo cat $TMP1 | sed -e "s/<ACE_DIRECT_FQDN>/${ACEDIRECT_FQDN}/g" > $TMP2
sudo cp $TMP2 /etc/nginx/nginx.conf
rm $TMP1 $TMP2 $TMP3 >/dev/null 2>&1

# restart NGINX
sudo service nginx stop
sudo service nginx start
sudo service nginx restart  # another way
sudo service nginx status
pidof nginx

printf "done.\n\n"