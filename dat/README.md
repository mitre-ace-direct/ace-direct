# dat

This repo contains configuration and data files for the ACE Direct system. It lives in the home folder of the ACE Direct user (~/).

## config.json_TEMPLATE

All ACE Direct servers use a global JSON configuration file named *config.json*. The default version of this configuration file is named *config.json_TEMPLATE*. You may copy config.json_TEMPLATE to config.json initially, or let the automated installation process do it for you (see the autoinstall repo). The common section of the configuration file contains common parameters for all servers. The remaining sections are application-specific parameters. Create the initial config.json file, then add the values for your environment. Use parameter_desc.json as a reference for choosing the appropriate configuration values. The config.json file is ignored by Git, so doing a ```git pull``` will not overwrite your existing config.json file.

## parameter_desc.json

The purpose of the *parameter_desc.json* file is to document each parameter in the global configuration file. This file serves as a reference for completing the configuration process. It has the same structure as *config.json_TEMPLATE*, but the values are descriptions of each parameter. This file must be maintained along with *config.json_TEMPLATE*.

## color_config.json_TEMPLATE and default_color_config.json_TEMPLATE

The *color_config.json_TEMPLATE* and *default_color_config.json_TEMPLATE* files are the Kuando Busylight Configuration Files. To create them for the first time, rename them to *color_config.json* and *default_color_config.json*. The *default_color_config.json* file is a 508 compliant color scheme. Do not change this file. Make any custom changes in the *color_config.json* file, but there is a Management Portal web page that maintains this. For dynamic updating of Busylight status colors, the Management Portal reads the ACE Direct URL from the configuration file.

## process.json_TEMPLATE

The purpose of the process.json_TEMPLATE file is to simplify the starting/stopping/restarting of ACE Direct servers. To create it for the first time, rename it to process.json. ACE Direct uses the *pm2* program to manage processes. To start all servers the first time: ```pm2 start process.json```. Then you may execute ```pm2 start all```, ```pm2 stop all```, ```pm2 restart all```, ```pm2 start 1```, ```pm2 stop 1```, etc.

## acedirectdefault.sql

This file is a SQL script to create the initial ACE Direct database and populate it with sample data. You should replace the following parameters in the file with your own: 

* _EXTENSION_PASSWORD_ : the password used for the WebRTC agent extensions (found in pjsip.conf of Asterisk)
* _ACEDIRECT_PASSWORD_: The password of the `acedirect` MySQL user 
* _ASTERISK_PASSWORD_: The password of the `asterisk` MySQL user 

After installing MySQL, you can import the database and user config with the following command:

```
[centos@dev1demo ~]$ mysql -u someuser -p -h 127.0.0.1 acedirect < acedirectdefault.sql
```

Finally, update your ~/dat/config.json file to point to this ACE Direct database.


