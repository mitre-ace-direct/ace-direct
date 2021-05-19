import subprocess
import sys
import os.path
from time import sleep
import json
from util import get_input
from util import get_config_value

default_java_package = 'java-1.8.0-openjdk-devel.x86_64'
configuration_file = './oam_installer.json'
lvl = 'common'

def install():
  version = get_config_value(lvl,'java')
  ans = get_input('Do you want to install/update ' + version + ' ? [y/n] ')
  while ans != 'y' and ans != 'n':
      ans = get_input('Do you want to install/update ' + version + ' ? [y/n] ')
  if (ans == 'n'):
    print('Skipping Java installation.')
    print('Exiting...')
    exit()
  check_java = 'rpm -q java-1.8.0-openjdk-devel.x86_64 > /dev/null'
  result = subprocess.call(check_java, shell='True')
  if result != 0:
    print('Attempting ' + version + ' installation...')
    sleep(2)
    result = subprocess.call('sudo yum -y install ' + version, shell='True')
    if result == 0:
      print('Installation successful!')
  else:
    print('The required version of java is already installed.')
    print('Exiting...')


if __name__ == '__main__':
  install()
