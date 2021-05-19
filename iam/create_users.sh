#!/bin/bash
# Create users in the container ( run after you configure container)
#
sudo docker exec openam2 /bin/bash -c "cd oam/SSOAdminTools*; bash ./setup -p /usr/local/tomcat/webapps/ace -l ./log -d ./debug --acceptLicense"
sudo docker exec openam2 /bin/bash -c '
cd oam/SSOAdminTools* 
cd ace/bin 
cp ssoadm ssoadm.bak 
LAST=$(tail -1 ssoadm)
head -n -1 ssoadm.bak >t
echo "    -D\"javax.net.ssl.trustStore=/opt/server.keystore\" \\" >> t
echo "-Djavax.net.ssl.trustStorePassword=changeit \\" >> t
echo "$LAST" >>t
cp t ssoadm
rm t
echo -n "$ADMIN_PWD" > /tmp/pwd
#echo -n "$AMLDAPUSERPASSWD" > /tmp/pwd
chmod 400 /tmp/pwd
bash ./ssoadm list-servers -v -u amadmin -f /tmp/pwd
bash ./ssoadm create-identity -u amadmin -f /tmp/pwd -e / -i dagent1 -t User -a "userpassword=Dagent1#" 
rm /tmp/pwd
'



