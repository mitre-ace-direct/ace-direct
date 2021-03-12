import subprocess
import sys
import os.path
from time import sleep
import platform
import json
from util import get_config_value
from util import get_input

default_server_config = '../config/tomcat/server.xml'
default_service_config = '../config/tomcat/tomcat.service'
lvl = 'apache'
common = 'common'


def cleanup():

    print('Cleaning and removing Tomcat configuration files...')
    subprocess.call('rm -rf /opt/tomcat', shell=True)
    subprocess.call('rm -rf /opt/apache-tomcat-7.*', shell=True)
    subprocess.call('rm -rf /etc/systemd/system/tomcat.service', shell=True)
    print('Tomcat config files removed.')


# mode: silent/prompt, c: continue/clean
def install(mode, c):
    # User wants to uninstall/clean up tomcat
    if c == 'clean':
        cleanup()
        exit()
    version = get_config_value(common, 'tomcat')
    if mode == 'prompt':
        ans = get_input(
            'Do you want to install Tomcat ' + version + '? [y/n] ')
        if (ans == 'n'):
            print('Skip installing Tomcat')
            exit()
    # install wget
    print('Installing wget...')
    subprocess.call('sudo yum install -y wget', shell='True')

    print('Installing Tomcat version ' + version)

    subprocess.call('groupadd tomcat  >/dev/null 2>&1 ', shell=True)
    subprocess.call(
        'useradd -s /bin/nologin -g tomcat -d /opt/tomcat tomcat  >/dev/null 2>&1 ', shell=True)
    major_version = version.split('.')[0]
    tar_name = 'apache-tomcat-' + version
    subprocess.call(
        'wget http://archive.apache.org/dist/tomcat/tomcat-' + major_version +
        '/v' + version + '/bin/' + tar_name + '.tar.gz',
        shell=True)

    subprocess.call(' rm -rf /opt/tomcat', shell=True)
    subprocess.call(' mkdir -p /opt/tomcat', shell=True)
    subprocess.call(
        ' tar -zxvf ' + tar_name + '.tar.gz' +
        ' -C /opt/tomcat --strip-components=1',
        shell=True)
    subprocess.call(' chgrp -R tomcat /opt/tomcat/conf ', shell=True)
    subprocess.call(' chmod g+rwx /opt/tomcat/conf ', shell=True)
    subprocess.call(' chmod g+r /opt/tomcat/conf/* ', shell=True)
    subprocess.call(
        ' chown -R tomcat /opt/tomcat/logs/ /opt/tomcat/temp/ /opt/tomcat/webapps/ /opt/tomcat/work/ ',
        shell=True)
    subprocess.call(' chgrp -R tomcat /opt/tomcat/bin ', shell=True)
    subprocess.call(' chgrp -R tomcat /opt/tomcat/lib  ', shell=True)
    subprocess.call(' chmod g+rwx /opt/tomcat/bin ', shell=True)
    subprocess.call(' chmod g+r /opt/tomcat/bin/* ', shell=True)
    # change ownership of top level /opt/tomcat directory to user:tomcat
    # this allows the configuration tool to finish without any errors since it can write create the .openamcfg directory without running into permission issues
    subprocess.call(' chown tomcat /opt/tomcat/', shell=True)

    # update server.xml and tomcat.service
    if (mode == 'silent'):
        try:
            server_config = get_config_value(lvl, 'tomcat_server_config')
        except:
            print('Using server.xml file at: ' + server_config)
        try:
            service_config = get_config_value(lvl, 'tomcat_service_config')
        except:
            print('Using tomcat service config file at: ' + service_config)
    else:
        print('Please update keystore path. Save changes when you are done..')
        sleep(5)
        subprocess.call('vim +121 ../config/tomcat/server.xml', shell=True)
        print('Please update tomcat.service. Save changes when you are done..')
        sleep(5)
        subprocess.call('vim +17 ../config/tomcat/tomcat.service', shell=True)
        server_config = default_server_config
        service_config = default_service_config

# move the files to the right location
    print('Moving configs into place ....')
    subprocess.call(
        ' cp {server_config} /opt/tomcat/conf'.format(
            server_config=server_config),
        shell=True)
    subprocess.call(
        ' cp {service_config} /etc/systemd/system/tomcat.service'.format(
            service_config=service_config),
        shell=True)
    subprocess.call(
        ' cp {keystore} /opt/tomcat'.format(
            keystore=get_config_value(lvl, 'keystore_path')),
        shell=True)

    print('Starting tomcat service ....')
    subprocess.call(' systemctl daemon-reload', shell=True)
    subprocess.call(' systemctl restart tomcat.service', shell=True)
    subprocess.call(' systemctl enable tomcat.service', shell=True)
    sleep(10)

    print('Cleaning up ....')
    subprocess.call('rm apach*.tar.gz*', shell=True)

    # finish
    print('Tomcat installation complete!.')

if __name__ == '__main__':
    mode = 'prompt'
    c = 'continue'
    for arg in sys.argv:
        if (arg == '-silent'):
            mode = 'silent'
        elif (arg == '-clean'):
            c = 'clean'
        elif (arg == '-help'):
            print('Usage: tomcat_installer.py -silent -clean')
            print('  -silent: silent mode.')
            print('  -clean: remove configuration files')
            exit()
    install(mode, c)
