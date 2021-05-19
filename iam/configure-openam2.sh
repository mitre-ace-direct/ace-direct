#!/bin/bash
#
java -Djavax.net.ssl.trustStore=../keystore/iamkeystore -jar //home/centos/src/docker/iam/iam/config/oam/SSOConfiguratorTools-13.0.0/openam-configurator-tool*.jar --file /home/centos/src/docker/iam/iam/config/oam/config.properties --acceptLicense
