from util import get_config_value
import json
import subprocess
import os

lvl = 'oam'

def is_service_running(name):
    with open(os.devnull, 'wb') as hide_output:
        exit_code = subprocess.Popen(['service', name, 'status'], stdout=hide_output, stderr=hide_output).wait()
        return exit_code == 0

if __name__ == '__main__':
    # get the users to create with openam
    try:
        users = get_config_value(lvl, 'users')
    except:
        print('Could not get users from config file')
        print('Make sure they exist')
        print('Exiting...')
        exit()

    # make sure that tomcat/openam is running
    if not is_service_running('tomcat'):
        print('Tomcat does not appear to be running')
        print('Start tomcat and try running this script again')
        print('Exiting...')
        exit()

    # loop through the users array and programmatically create the users for openam
    print('Creating users for openam...')
    for user in users:
        username = user['username']
        password = user['password']
        realm = user['realm']
        user_type = user['type']

        # create the users
        cmd = 'bash {ssoadm} create-identity -u {admin} -f {pwd_file} -e {realm} -i {username} -t {user_type} -a "userpassword={user_password}"'.format(
            ssoadm=get_config_value(lvl,'ssoadm_file'), admin=get_config_value(lvl, 'adminid'), pwd_file=get_config_value(lvl,'admin_pwd_file'),
            realm=realm, username=username, user_type=user_type, user_password=password)
        subprocess.call(cmd,shell=True)
    print(('{user_len} users created.'.format(user_len=len(users))))
    print('Done.')




