#!/bin/bash
#
# NOTE: 
#  - UPDATE THIS FILE WITH IP ADDRESSES and FQDNs for your HOSTS
#  - 0.0.0.1 is the private IP for the openam host
#  - 0.0.0.2 is the private IP for the docker host

if ! grep -q "^0.0.0.1" /etc/hosts; then
echo "0.0.0.1 openam.domain.com openam" >> /etc/hosts
echo "0.0.0.2 docker.domain.com docker" >> /etc/hosts
fi

#
confd -onetime
/usr/local/nginx/sbin/nginx -c /etc/nginx/nginx.conf -g "daemon off;"
