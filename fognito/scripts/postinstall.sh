#!/bin/bash

echo 'postinstall...'
cp node_modules/ejs/ejs.min.js public/dist/js/.
cp node_modules/jquery/dist/jquery.min.js public/dist/js/.
cp node_modules/bootstrap/dist/css/bootstrap.min.css public/dist/css/.
cp node_modules/bootstrap/dist/js/bootstrap.min.js public/dist/js/.
cp node_modules/@fortawesome/fontawesome-free/css/all.css public/dist/css/.
cp node_modules/@fortawesome/fontawesome-free/webfonts/* public/dist/webfonts/

cp node_modules/popper.js/dist/popper.min.js.map public/js/.
cp node_modules/bootstrap/dist/css/bootstrap.min.css.map public/dist/css/.
cp node_modules/bootstrap/dist/js/bootstrap.min.js.map public/dist/js/.
