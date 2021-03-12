import subprocess
import os
import json
from util import get_config_value

# top level for accessing config.json
lvl = 'apache'
common = 'common'

def create_pkcs12():
    """Creates a pkcs12 keystore"""
    cmd = 'openssl pkcs12 -export -in {cp} -inkey {ckp} -out {p12_out} -passout pass:{p12_export} -name {alias}'.format(
        cp=get_config_value(lvl,'cert_path'), ckp=get_config_value(lvl,'cert_key_path'),
        p12_out=get_config_value(lvl,'p12_out_filename'),
        p12_export=get_config_value(lvl,'p12_export_pass'), alias=get_config_value(lvl,'alias'))
    res = subprocess.call(cmd, shell='True')


def import_to_keystore():
    """Imports the created pkcs12 keystore into Java's keystore container"""
    cmd = 'keytool -importkeystore -deststorepass {dsp} -destkeypass {dkp} -destkeystore {dks} -srckeystore {sks} -srcstoretype pkcs12 -srcstorepass {ssp} -alias {alias} -noprompt'.format(
        dsp=get_config_value(lvl,'dest_keystore_pass'), dkp=get_config_value(lvl,'dest_keystore_pass'),
        dks=get_config_value(lvl,'keystore_path'), sks=get_config_value(lvl,'p12_out_filename'),
        ssp=get_config_value(lvl,'p12_export_pass'), alias=get_config_value(lvl,'alias'))
    res = subprocess.call(cmd, shell='True')

def java_installed():
    """Checks if the specified version of Java is installed"""
    cmd = 'rpm -q {java} > /dev/null'.format(java=get_config_value(common,'java'))
    result = True if subprocess.call(cmd, shell='True') == 0 else False
    return result

if __name__ == '__main__':
    # check to make sure both cert and key files are present at their specified paths
    try:
        cert = open(get_config_value(lvl,'cert_path'))
        key = open(get_config_value(lvl,'cert_key_path'))
    except:
        print('cert.pem and/or key.pem do not exist')
        print('Exiting...')
        exit()
    if not java_installed():
        print('The required version of java does not appear to be installed on your machine which is a requirement for this script to run properly')
        print('Please execute java_installer.py first')
    else:
        # create the pkcs12 keystore from cert and key
        create_pkcs12()
        # import into keystore using java's keytool
        import_to_keystore()
