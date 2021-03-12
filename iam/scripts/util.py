import os
import json
import sys

keystore_config = '../config/config.json'

def get_config_value(level,param):
    """Returns the parameter's associated config value from the keystore config file """
    if (os.path.lexists(keystore_config)):
        try:
            with open(keystore_config) as json_file:
                json_data = json.load(json_file)
                data = json_data[level][param]
                return data
        except Exception as e:
            print('Could not get config parameter for ' +level+':'+param)
    else:
        raise Exception('Could not find config.json file.')

def get_input(prompt):
    # Python 2/3 compatibility
    if (sys.version_info>(3,0)):
        ans = input(prompt)
    else:
        ans = raw_input(prompt)
    return ans