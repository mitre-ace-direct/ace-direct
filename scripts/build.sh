#!/bin/bash

echo "building ace-direct..."
cd ~/ace-direct
pm2 stop all > /dev/null 2>&1
pm2 delete all > /dev/null 2>&1
npm run clean
START=`date +%s`
npm install
npm run build
END=`date +%s`
pm2 start dat/process.json
EQU="scale=2; (${END} - ${START})/60"
RESULT=`bc <<< $EQU`
npm run status
echo ""
echo "*** That took $RESULT minutes. ***"
echo ""
