#!/bin/bash

 echo 'preinstall...'
 mkdir -p public/dist/js
 mkdir -p public/dist/css
 mkdir -p public/dist/webfonts

# install npm global tools if not there already
declare -a arr=("eslint" "gulp" "pm2" "bower" "jsonlint" "nodemon")
for i in "${arr[@]}"
do
  if ! command -v ${i} &> /dev/null
  then
    echo "command ${i} does NOT exist. installing..."
    npm install -g ${i}
  fi
done

# of course ejs-lint is different
if ! command -v ejslint &> /dev/null
then
  echo "command ejslint does NOT exist. installing..."
  npm install -g ejs-lint  # lib name is different from executable name
fi
