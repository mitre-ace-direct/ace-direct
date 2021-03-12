from subprocess import call
from time import sleep
import os
import sys
import subprocess
import json
from util import get_config_value


# get base name from environment; should've been configured by user during installation
base_name=''
try:
  base_name=os.environ['OPENAM_BASE_NAME']
  print('base_name is: ' +  base_name)
except:
  print("*****")
  print("ERROR!!!! please define the OPENAM_BASE_NAME environment variable")
  print("*****")
  sys.exit()


default_war_file = '../config/oam/' + base_name + '.war'
default_ssoconfig_file = '../config/oam/SSOConfiguratorTools-13.0.0/openam-configurator-tool-13.0.0.jar'
oam_config = '../config/oam/config.properties'
configuration_file = './oam_installer.json'
lvl = 'oam'


def grep(filename, pattern, index):
    for n, line in enumerate(open(filename)):
        if pattern in line:
            value = line.split('=')[index]
            return value


def is_service_running(name):
    with open(os.devnull, 'wb') as hide_output:
        exit_code = subprocess.Popen(['service', name, 'status'], stdout=hide_output, stderr=hide_output).wait()
        return exit_code == 0

def cleanup():
    print('cleanup files ...')
    # tomcat_installer.cleanup()


def install(mode, c):
    try:
        war_file = get_config_value(lvl, 'war_file')
    except:
        war_file = default_war_file
    try:
        sso_file = get_config_value(lvl,'ssoconfig_file')
    except:
        sso_file = default_ssoconfig_file

    # make sure Tomcat is running. Abort if Tomcat is not running
    print('Using IAM config file: ' + oam_config)

    print('Using war file: ' + war_file)
    print('Using ssoconfig: ' + sso_file)

    if not is_service_running('tomcat'):
        print('Existing: Tomcat is not running...')
        exit()
    else:
        print('Checked: Tomcat service is running...')

    # update config file
    if (mode != 'silent'):
        print('***  Please UPDATE all entries with the "UPDATE" (8) in the comment and save the changes ***')
        print('... ')
        sleep(4)
        call(["vim", "+40", oam_config])

    # deploy and configure
    chome = grep('../config/tomcat/tomcat.service', 'CATALINA_HOME', 2).rstrip()
    print('Tomcat home = ' + chome)
    if (chome):
        call('cp ' + war_file + ' ' + chome + '/webapps', shell=True)
    else:
        print('Exiting due to Tomcat Error: CATALINA_HOME is not defined')
        exit()

    # copy files - sleep until war is deployed
    print('Deploying openam ....')
    sleep(35)
    call('cp ../config/oam/DataStore.xml ' + chome + '/webapps/' + base_name + '/config/auth/default_en', shell=True)
    call('cp ../config/oam/index.html  ' + chome + '/webapps/' + base_name + '/XUI', shell=True)
    call('cp ../config/oam/ThemeConfiguration.js ' + chome + '/webapps/' + base_name + '/XUI/config', shell=True)
    call('cp ../config/oam/translation.json ' + chome + '/webapps/' + base_name + '/XUI/locales/en', shell=True)
    call('cp ../config/oam/FooterTemplate.html ' + chome + '/webapps/' + base_name + '/XUI/templates/common', shell=True)
    call('cp ../images/login-logo.png ' + chome + '/webapps/' + base_name + '/XUI/images', shell=True)
    call('cp ../images/logo-horizontal.png ' + chome + '/webapps/' + base_name + '/XUI/images', shell=True)
    call('cp ../images/favicon.ico ' + chome + '/webapps/' + base_name + '/XUI', shell=True)
    call('cp ../images/PrimaryProductName.png ' + chome + '/webapps/' + base_name + '/console/images', shell=True)

    # configure
    # get the keystore file location from server.xml
    loc = grep('../config/tomcat/server.xml', 'keystoreFile', 1)
    loc2 = grep('../config/tomcat/server.xml', 'keystorePass', 1)
    # cmd = 'java -Djavax.net.ssl.trustStore=' + loc.rstrip() + ' -jar ./openam-configurator-tool-13.0.0.jar --file ../iam-configs/config.properties'
    cmd = 'java -Djavax.net.ssl.trustStore=' + loc.rstrip() + ' -Djavax.net.ssl.trustStorePassword=' + loc2.rstrip()  +  ' -jar ' + sso_file + ' --file ' + oam_config
    print('Configuring OpenAM: ' + cmd)
    call(cmd, shell=True)
    sleep(2)


if __name__ == '__main__':
    mode = 'prompt'
    c = 'continue'
    for arg in sys.argv:
        if (arg == '-silent'):
            mode = 'silent'
        elif (arg == '-clean'):
            c = 'clean'
        elif (arg == '-help'):
            print('Usage: oam__installer.py -silent -clean')
            print('  -silent: silent mode.')
            print('  -clean: remove configuration files')
            exit()
    install(mode, c)
