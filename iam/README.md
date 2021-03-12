# ACE Identity and Access Management (IAM) Server

![ACE](images/acesmall.png)

ACE Direct uses the open-source [OpenAM tool](https://github.com/OpenIdentityPlatform/OpenAM) for identity and access management.

The installation, configuration, and deployment procedures in this document are for _OpenAM v13.0.0_.

## Prerequisites

### Notes and assumptions

1. The OpenAM server is running CentOS Linux. Other Linux versions may work, with or without minor modifications to the installation scripts.
1. Install OpenAM as `root` in the `/root` home folder of the OpenAM server.
1. OpenAM will run behind NGINX. See the ACE Direct `nginx` repo for configuration details.
1. OpenAM only has a private IP address. Do **not** assign a public IP address to it.
1. Certificates are required to secure the OpenAM login process:

    * This installation expects these certificate file names: `cert.pem` and `key.pem`
    * Certificates must be acquired from a trusted certificate authority
    * Acquire a fully-qualified domain name (FQDN) for the OpenAM server that is _at least_ two levels deep. For example: `aceopenam.domain.com`
    * Do **not** use underscores (`_`) in the FQDN name. OpenAM does not like that.

1. Execute the `hostname` command and verify that the FQDN aligns with the FQDN in the certificates.
1. Edit `/etc/hosts` to include the **private IP**, **alias**, and **FQDN** for the OpenAM, NGINX, and Node ACE Direct servers.
1. You _may_ have to remove any previous OpenAM and Tomcat installations to ensure a proper installation.
1. _Note: If the OpenAM server is running behind a network proxy_, create an entry for the `http_proxy` for `wget`. Depending on your operating system, it may be in `~/.wgetrc` or `/etc/wgetrc`.

### Files

1. Copy this `iam` folder to the `/root` folder on the OpenAM server.
1. Execute the commands below on the OpenAM server as `root`.

### Certificates

1. Copy the acquired `cert.pem` and `key.pem` certificates to `/root/iam/ssl/` and modify ownership and permissions:

  ```bash
  $  # logged in as root
  $  cd /root/iam/ssl/
  $  chown root cert.pem
  $  chgrp root cert.pem
  $  chown root key.pem
  $  chgrp root key.pem
  $  chmod 644 cert.pem key.pem
  $
  ```

### Environment variables

Add an environment variable for the base name of this installation. This installation assumes an OpenAM _base name_ of `ace`. Note that this base name is used to configure ACE Direct in `ace-direct/dat/config.json`, in the `openam:path` variable.

  ```bash
  $  echo "export OPENAM_BASE_NAME=ace" >> /root/.bashrc
  $  source /root/.bashrc
  $  env | grep OPENAM_BASE_NAME  # verify
  $
  ```

### Required software tools

Install these software tools if they are not present:

* Python 2.7.x
* Linux commands: `wget`, `unzip`

## OpenAM configuration

Here are the OpenAM configuration files:

* Global configuration file: `/root/iam/config/config.json`
* Tomcat configuration files:  `/root/iam/config/tomcat/server.xml` , `/root/iam/config/tomcat/tomcat.service`
* OpenAM configuration file: `/root/iam/config/oam/config.properties`

The following sections describe how to configure these files.

### General Configuration

Set/view `/root/iam/config/config.json`. You may set the `common:java` and `common:tomcat` versions or keep the defaults.

If you need to install Java, confirm/update the `common:java` value, then run the installation script to install:

```bash
$  cd /root/iam/scripts
$  python java_installer.py
$
```

### Apache Tomcat Configuration

Apache Tomcat configuration is in the `apache` section of  `/root/iam/config/config.json`. Note that the file paths are relative to`/root/iam/scripts/`. These default values will work out of the box:

```json
"apache": {
    "cert_path": "../ssl/cert.pem",
    "cert_key_path": "../ssl/key.pem",
    "p12_out_filename": "../ssl/cert.p12",
    "p12_export_pass": "root",
    "alias": "tomcat",
    "dest_keystore_pass": "changeit",
    "keystore_path": "../ssl/.keystore",
    "keystore_dest_path":"/opt/tomcat/.keystore",
    "tomcat_server_config":"../config/tomcat/server.xml",
    "tomcat_service_config":"../config/tomcat/tomcat.service"
},
```

Where...

* `cert_path`: the ssl certificate
* `cert_key_path`: the ssl certificate key
* `p12_out_filename`: the filename for the pkcs12 keystore to be imported into the jks keystore
* `p12_export_pass`: the export password associated with pkcs12
* `alias`: the alias used to identify the tomcat keystore entry
* `dest_keystore_pass`: the password to access the jks keystore; set 'keystorePass' in `server.xml` to this same value
* `keystore_path`: the initial file path for generated jks keystore
* `keystore_dest_path`: the destination keystore path - tomcat_installer will move keystore here
* `tomcat_server_config`: the location of `server.xml` in this repo
* `tomcat_service_config`: the location of `tomcat.service` in this repo

### OpenAM Configuration

1. Log in to the OpenAM server as root.
1. `cd /root`
1. Download the OpenAM 13.0 zip file:

    * [OpenAM-13.0.0.zip](https://backstage.forgerock.com/downloads/get/familyId:am/productId:openam/minorVersion:13/version:13.0.0/releaseType:full/distribution:zip). You will have to create an account and log in to download the file.
    * Or get it from GitHub: `wget --no-check-certificate https://github.com/OpenIdentityPlatform/OpenAM/releases/download/13.0.0/OpenAM-13.0.0.zip`
    * FTP the file to the `/root` folder on the Open AM server. Make sure `root` has full permissions on the file.
    * Unzip the file: `unzip OpenAM-13.0.0.zip`. This will create the `openam` folder.

1. Copy the `OpenAM-13.0.0.war` file to `/root/iam/config/oam/ace.war`: `cp /root/openam/OpenAM-13.0.0.war /root/iam/config/oam/ace.war` . If you changed the base name, rename the `.war` file to reflect the new base name. For example, if your new base name is `ace1`, then copy the file to `ace1.war`.
1. Edit `/root/iam/config/config.json` and set/verify the following fields. Note that all file paths are relative to: `/root/iam/scripts/`. Default values will work, but make any updates to values that are using _non-default values_:

    ```json
    "oam": {
        "oam_path" : ".",
        "ssoadm_file" : "../config/oam/SSOAdminTools-13.0.0/ace/bin/ssoadm",
        "ssoconfig_file":"../config/oam/SSOConfiguratorTools-13.0.0/openam-configurator-tool-13.0.0.jar",
        "war_file" : "../config/oam/ace.war",
        "adminid": "amadmin",
        "admin_pwd_file": "../config/oam/SSOAdminTools-13.0.0/ace/bin/pwd.txt",
        "users": [
            {
                "username": "dagent1",
                "password": "Dagent1#",
                "realm": "/",
                "type": "User"
            },
            {
                "username": "dagent2",
                "password": "Dagent2#",
                "realm": "/",
                "type": "User"
            },
            {
                "username": "dagent3",
                "password": "Dagent3#",
                "realm": "/",
                "type": "User"
            },
            {
                "username": "dagent4",
                "password": "Dagent4#",
                "realm": "/",
                "type": "User"
            },
            {
                "username": "dagent5",
                "password": "Dagent5#",
                "realm": "/",
                "type": "User"
            },
            {
                "username": "manager",
                "password": "manager1234",
                "realm": "/",
                "type": "User"
            },
            {
                "username": "supervisor",
                "password": "supervisor1234",
                "realm": "/",
                "type": "User"
            }
        ]
    }
    ```

    Where...

    * `oam_path`: OpenAM path
    * `ssoadm_file`: location of the ssoadm executable; created during administration tools setup; update if you changed the base name for this installation
    * `ssoconfig_file`: location of the sso OpenAM configurator tool
    * `war_file`: location of the original OpenAM ace deployment file; update if you changed the base name for this installation
    * `adminid`: default admin id used for admin tools
    * `admin_pwd_file`: path to the file containing the admin password in cleartext; created later; update if you changed the base name for this installation
    * `users`: JSON array of agents to create; you may add/remove agents or modify usernames and passwords

### SSL Configuration

1. Edit `/root/iam/config/tomcat/server.xml`
1. For SSL configuration, select the OpenAM port number. The default for this installation is `8443`. If you need to change the port number, see `Line 117 and 128`. Below is a snippet of the default configuration showing port `8443` on the first and last lines:

    ```xml
    <Connector port="8443" protocol="org.apache.coyote.http11.Http11NioProtocol"
        sslImplementationName="org.apache.tomcat.util.net.jsse.JSSEImplementation"
        maxThreads="150"
        scheme="https" SSLEnabled="true"
        keystoreFile="/opt/tomcat/.keystore"
        keystorePass="changeit"
        keyAlias="tomcat"
        clientAuth="false" sslProtocol="TLSv1.2" URIEncoding="UTF-8"/>

    <!-- Define an AJP 1.3 Connector on port 8009 -->
    <Connector port="8009" protocol="AJP/1.3" redirectPort="8443" />
    ```

1. Field descriptions and default values:

   * `port`: desired **SSL PORT** for OpenAM. The default is port `8443`.
   * `keystoreFile`: path where Tomcat will look for the jks keystore. This must match the `apache:keystore_dest_path` value in `/root/iam/config/config.json`.
   * `keystorePass`: password associated with your generated keystore; This must match the `apache:dest_keystore_pass` value in `/root/iam/config/config.json`.
   * `keyAlias`: name associated with the Tomcat entry within the keystore; This must match the  `apache:alias` value in `/root/iam/config/config.json`

### Tomcat Service Configuration

1. Edit `/root/iam/config/tomcat/tomcat.service`. It will look like this:

  ```bash
  [Unit]
  Description=Apache Tomcat Web Application Container
  After=syslog.target network.target

  [Service]
  Type=forking
  Environment=JAVA_HOME=/usr/lib/jvm/java-1.8.0-openjdk-1.8.0.252.b09-2.el7_8.x86_64
  Environment=JRE_HOME=/usr/lib/jvm/java-1.8.0-openjdk-1.8.0.252.b09-2.el7_8.x86_64
  Environment=CATALINA_PID=/opt/tomcat/temp/tomcat.pid
  Environment=CATALINA_HOME=/opt/tomcat
  Environment=CATALINA_BASE=/opt/tomcat
  Environment='CATALINA_OPTS=-Xms512M -Xmx1024M -server -XX:+UseParallelGC'

  ExecStart=/opt/tomcat/bin/startup.sh
  ExecStop=/bin/kill -15 $MAINPID

  User=tomcat
  Group=tomcat

  [Install]
  WantedBy=multi-user.target
  ```

1. In the file above, **you will likely have to update the JAVA_HOME and JRE_HOME values**:

   * First, make sure Java is installed: `which javac`. If not, then: `cd /root/iam/scripts; python java_installer.py`
   * Find the absolute path of the OpenJDK version: `echo $(dirname $(dirname $(readlink -f $(which javac))))` . If the command fails, install OpenJDK on the OpenAM server and try again: `cd /root/iam/scripts; python java_installer.py`
   * `JAVA_HOME`: absolute path of the OpenJDK version.  
   * `JRE_HOME`: same value as `JAVA_HOME`
   * Verify/verify other fields in `/root/iam/config/tomcat/tomcat.service`.

### OpenAM Properties

1. Edit `/root/iam/config/oam/config.properties`.
1. Update the following values:

   * `SERVER_URL`: *You must update this value.* Use the OpenAM **FQDN** and **SSL Port Number** that you chose for this installation, for example: `https://aceopenam.domain.com:8443`. The port number must match SSL port number in `server.xml`. See [SSL Configuration](#ssl-configuration)).
   * `COOKIE_DOMAIN`: *You must update this value.*. Last part of the OpenAM FQDN, for example, `.company.com`
   * `DEPLOYMENT_URI`: If you modified the base name for this installation, change this value to reflect that, for example: `/ace`
   * `BASE_DIR`: the base directory of your OpenAM deployment. If you modified the base name for this installation, change this value to reflect that, for example: `/opt/tomcat/webapps/ace`
   * `ADMIN_PWD`: 8 characters minimum.
   * `AMLDAPUSERPASSWRD`: 8 characters minimum.
   * `DIRECTORY_SERVER`: *You must update this vaue.* OpenAM FQDN, for example, `aceopenam.domain.com`
   * `DS_DIRMGRPASSWD`: 8 characters minimum and should NOT be the same as ADMIN_PWD or AMLDAPUSERPASSWRD.

---

## Automated Installation Option 1 RECOMMENDED METHOD

With the above configuration complete, you may now begin the installation process. The *automated installation* installs and configures Tomcat and OpenAM into `/opt/tomcat` for simplicity's sake. This is the default configuration. Several Python scripts facilitate the installation and configuration.

### Assumptions

* OpenAM uses DNS (if the environment supports this configuration) for IP mapping, or it uses `/etc/hosts`. The IP address in the DNS lookup must be accessible by OpenAM. Restart NGINX and OpenAM if switching from DNS to `/etc/hosts` or vice versa.
* All configuration files have been properly configured as described in the previous sections.
* All prerequisites have been satisfied as decribed above.
* Assumes the base name of `ace`. This is seen in folder and file names in commands below. If you changed the base name, **you will have to update the names in the commands below before executing them**.

### Installation

Update the following files before running the Java, Tomcat, or the OAM installer programs:

1. Log in as `root` on the OpenAM server.
1. Verify/add the following lines to `~/.bashrc`. **You must update the JAVA_HOME variable** with the *same JAVA_HOME value* in `/root/iam/config/tomcat/tomcat.service`:

  ```bash
  PATH=$PATH:$HOME/bin

  # TODO: set to JAVA_HOME value in /root/iam/config/tomcat/tomcat.service
  JAVA_HOME=TODO_PATH_TO_OPENJDK  
  export JAVA_HOME

  export JAVA_OPTS="-server  -Xmx2048m -Xms128m  -XX:+UseConcMarkSweepGC -XX:+UseSerialGC"
  PATH=$PATH:$JAVA_HOME/bin
  export PATH
  ```

1. Source the file: `source /root/.bashrc`
1. Verify that you have Java: `which javac`
1. Stop any existing tomcat service: `service tomcat stop`
1. Delete any existing `tomcat` user: `userdel -r tomcat`
1. Delete any existing tomcat installation: `rm -rf /opt/tomcat`
1. Go to the scripts folder: `cd /root/iam/scripts`
1. Generate the keystore: `python keystore.py`
1. Install and configure Apache Tomcat: `python tomcat_installer.py -silent`
1. Install and configure OpenAM `python oam_installer.py -silent`
1. Verify that OpenAM is running _before_ continuing with the installation. Find your private IP address and execute: `curl -k https://OPENAM_PRIVATE_IP:8443` . If successful, you will see the _Apache Software Foundation_ HTML page.

### Set Up OpenAM Admin Tools

With OpenAM/Tomcat up and running...

1. Run the setup utility to install the OpenAM Admin Tools:

    ```bash
    $  cd /root/iam/config/oam/SSOAdminTools-13.0.0
    $
    $  sudo -E bash setup -p /opt/tomcat/webapps/ace -l ./log -d ./debug --acceptLicense  
    $  
    ```

1. After the setup utility runs successfully, the administration tools will be in `/root/iam/config/oam/SSOAdminTools-13.0.0/ace/bin`:

    ```bash
    $ cd /root/iam/config/oam/SSOAdminTools-13.0.0/ace/bin
    $ ls
    ampassword  amverifyarchive  ssoadm  verifyarchive
    ```

1. *Modify* the `ssoadm` script to include the keystore information. This must match the `apache:keystore_path` and `apache:dest_keystore_pass` values in `/root/iam/config/config.json`. If using the default installation as specified above, simply **add** the two new `-D` lines just before the last `CommandManager` line of the script. If done correctly, the last three lines of `ssoadm` will be:

    ```bash
        -D"javax.net.ssl.trustStore="/root/iam/ssl/.keystore" \
        -D"javax.net.ssl.trustStorePassword="changeit" \
        com.sun.identity.cli.CommandManager "$@"
    ```

1. Set up and verify `ssoadmn`:

    ```bash
    $  cd  /root/iam/config/oam/SSOAdminTools-13.0.0/ace/bin
    $  touch pwd.txt  # create password file in the default location
    $
    $  # get value of ADMIN_PWD in /root/iam/config/oam/config.properties. add it to pwd.txt
    $  vi pwd.txt  # put ADMIN_PWD on one line here
    $  echo password1 > pwd.txt  # if using the default OpenAM Admin password
    $  chmod 400 pwd.txt  # change permissions
    $
    $  # run ssoadm to verify it
    $  ./ssoadm list-servers -u amadmin -f pwd.txt  
    $  # if successful, OpenAM URL is shown: https://aceopenam.domain.com:8443/ace
    $  # if error, the disk may be full
    $
    ```

1. Create the OpenAM agents/users:

    ```bash
    $  cd /root/iam/scripts
    $
    $  python create_users.py  # this will add agents one by one
    ```

1. Security requirement (optional) - restrict GOTO URLs in OpenAM. This prevents a URL redirect to a different web page. Assuming the public FQDN of the NGINX server is `portal.domain.com`:

    ```bash
    $  cd /root/iam/config/oam/SSOAdminTools-13.0.0/ace/bin
    $  ./ssoadm set-attr-defs -s validationService -t organization -u amadmin -f pwd.txt -a openam-auth-valid-goto-resources="https://portal.domain.com/*" openam-auth-valid-goto-resources="https://portal.domain.com/*?*"
    $
    ```

1. Security requirement (optional) - custom HTML error page. This shows an internal custom HTML page if a page is not found:

    * Log in as root
    * Copy the `html/notfound.html` file to `/opt/tomcat/webapps/ROOT/notfound.html`
    * Edit `/opt/tomcat/conf/web.xml`. Add the following code snippet right after the `welcome-file-list` group:

    ```xml
    <error-page>
    <error-code>404</error-code>
    <location>/notfound.html</location>
    </error-page>

    <error-page>
    <error-code>403</error-code>
    <location>/notfound.html</location>
    </error-page>

    <error-page>
    <error-code>500</error-code>
    <location>/notfound.html</location>
    </error-page>
    ```

    * Restart OpenAM

1. Session timeouts - if you need to change the maximum session and idle timeouts:

    ```bash
    $  cd /root/iam/config/oam/SSOAdminTools-13.0.0/ace/bin
    $  
    $  # configure the maximum session time to be 600 minutes (e.g.). Default is 120 minutes.
    $  ./ssoadm set-attr-defs -s iPlanetAMSessionService -t dynamic -u amadmin -f pwd.txt -a iplanet-am-session-max-session-time=600
    $  
    $  # configure the maximum idle time to be 600 minutes (e.g.). Default is 30 minutes.
    $  ./ssoadm set-attr-defs -s iPlanetAMSessionService -t dynamic -u amadmin -f pwd.txt -a iplanet-am-session-max-idle-time=600
    $
    ```

1. Configure success login URLs - each user (e.g. `dagent1`, `dagent2`, ... , `manager`, ...) should have a designated URL to go to upon successful login. This sets up the URL that agents and managers navigate to upon successful login:

    * From a web browser, log into OpenAM admin: [https://portal.domain.com/ace/XUI/](https://portal.domain.com/ace/XUI/)
    * Click _Top Level Realm_.
    * Click _Subjects_.
    * Click an agent _User_ (e.g., `dagent1`, `dagent2`).
    * Scroll down to _Success URL_.
    * Add a success URL for an agent: [https://portal.domain.com/ACEDirect/agent](https://portal.domain.com/ACEDirect/agent))
    * Click _Add_.
    * Scroll to the top and click _Save_ and _Back to Subjects_.
    * Repeat above for all agent usernames.
    * Repeat above for the `manager` and `supervisor` users, but use the success URL: [https://portal.domain.com/ManagementPortal](https://portal.domain.com/ManagementPortal).

1. Take note of the `oam.adminid` value and `oam.admin_pwd_file` values in `/root/iam/config/config.json`. You will need these values to configure your ACE Direct Node server. The configuration file is `~/dat/config.json` and the variables are `openam.user` and `openam.password`. The ACE Direct Management Portal needs this to maintain agent info.

### NGINX Configuration

In ACE Direct, OpenAM is hidden behind NGINX. For this installation of OpenAM, you will need this exact entry in the `/etc/nginx/nginx.conf` file of your NGINX server:

```bash
location /ace {
    proxy_set_header X-Real-IP $remote_addr;
    proxy_pass https://aceopenam.domain.com:8443;
    proxy_set_header Host aceopenam.domain.com:8443;
}
```

The NGINX route `/ace` **must match** the base name `ace` in this installation.

**Note:** whenever OpenAM restarts, you **must** restart NGINX, and you should restart all ACE Direct Node.js servers. All in this order.

### Testing OpenAM With NGINX

After updating the NGINX configuration and restarting NGINX. Assuming the public FQDN of the NGINX server is `portal.domain.com`, open a web browser and navigate to:

`https://portal.domain.com/ace`

**This completes the OpenAM installation and configuration.** :checkered_flag: :trophy:

### Reinstallation of OpenAM (optional)

You may need to reinstall OpenAM after installation errors. Or if there was a previous installation of OpenAM or Tomcat, then it would be wise to reinstall cleanly.

To reinstall OpenAM, remove the `tomcat` user, delete the `tomcat` folder, and clean up before reinstalling:

```bash
$  service tomcat stop  
$  ps -aef | grep tomcat # make sure it is really killed
$  userdel -r tomcat
$  rm -rf /opt/tomcat
$  rm -rf /etc/systemd/system/tomcat.service
$  rm /root/iam/ssl/.keystore  # remove keystore in case corrupt
$  rm /root/iam/ssl/cert.p12
$  cd /root/iam/scripts
$  python keystore.py
$  python tomcat_installer.py -silent
$  python oam_installer.py -silent
$  # set up OpenAM tools and add users. See below...
$
```

Then, repeat [Set Up OpenAM Admin Tools](#Set-Up-OpenAM-Admin-Tools).

### Tomcat Upgrade

Need to update Tomcat? Just update the `common:tomcat` value in `/root/iam/config/config.json` and reinstall OpenAM.

### Reinstallation With Custom Base (optional)

You may need a custom base name if you have a specific NGINX route for OpenAM. Follow these reinstallation instructions if you need to change the base name from `ace` to something else. This following instructions assume going from the default `ace` base namce to a new base name of `ace2`.

1. Start clean:

  ```bash
  $  service tomcat stop
  $
  $  userdel -r tomcat
  $  rm -rf /opt/tomcat
  ```

1. Update the base name environment variable to be `ace2`. Edit this entry in `/root/.bashrc`:

  ```bash
  export OPENAM_BASE_NAME=ace2
  ```

1. Now source the new environment: `source /root/.bashrc`

2. After unzipping `OpenAM-13.0.0.zip` in the [OpenAM Configuration](#OpenAM-Configuration) step, copy the `.war` file to the new base name: `cp /root/openam/OpenAM-13.0.0.war /root/iam/config/oam/ace2.war`

3. Update two variables in `/root/iam/config/oam/config.properties`:

  ```bash
  DEPLOYMENT_URI=/ace2
  BASE_DIR=/opt/tomcat/webapps/ace2
  ```

1. Change three values in `/root/iam/config/config.json` from `ace` to `ace2`:

```bash
"oam": {
    "oam_path" : ".",
    "ssoadm_file" : "../config/oam/SSOAdminTools-13.0.0/ace2/bin/ssoadm",
    "ssoconfig_file":"../config/oam/SSOConfiguratorTools-13.0.0/openam-configurator-tool-13.0.0.jar",
    "war_file" : "../config/oam/ace2.war",
    "adminid": "amadmin",
    "admin_pwd_file": "../config/oam/SSOAdminTools-13.0.0/ace2/bin/pwd.txt",
.
.
.
```

1. Reinstall:

  ```bash
  $  cd /root/iam/scripts
  $
  $  python keystore.py
  $  python tomcat_installer.py -silent
  $  python oam_installer.py -silent
  ```

1. Continue with [Set Up OpenAM Admin Tools](#Set-Up-OpenAM-Admin-Tools) below, but when executing commands, use the new working folders in commands and folder references:

  ```bash
  /opt/tomcat/webapps/ace
  /root/iam/config/oam/SSOAdminTools-13.0.0/ace
  ```

1. See [NGINX Configuration](#NGINX-Configuration). Note that `/ace` should now be `/ace2`. Each OpenAM instance in NGINX must have a unique route, and this unique route name must be the base name of the OpenAM installation (e.g., `/ace2`).

## System Administration

### Starting/Stopping Tomcat

Start tomcat: `sudo systemctl start tomcat.service`

Stop tomcat: `sudo systemctl stop tomcat.service`

Restart tomcat: `sudo systemctl restart tomcat.service`

### Removing OpenAM

1. Stop Apache Tomcat
2. Delete OpenAM configuration directory and associated `.war` file (e.g. `/opt/tomcat/webapps/ace` & `/opt/tomcat/webapps/ace.war`)
3. Delete `.openam.cfg` in the top level directory of the account where OpenAM is installed (`/opt/tomcat`)

### Removing Tomcat

1. Automated Method
    * Execute the tomcat_installer script passing in the *-clean* argument: `sudo python tomcat_installer.py -clean`
1. Manual Method
    * Remove the tomcat installation `sudo rm -rf /opt/tomcat`
    * Remove the service file `sudo rm -rf /etc/systemd/system/tomcat.service`

### Testing the Server in AWS

Usage: Enter the URL in the browser and the OpenAM login screen is displayed: `https://<FQDN>:<port>/ace`

## Troubleshooting

Some common issues and their possible resolutions.

### Errors

---

```bash
java.security.InvalidAlgorithmParameterException: the trustAnchors parameter must be non-empty
```

#### Problem 1

This error is related to the keystore and is likely due to one of the following issues:

1. The keystore specified in your command is empty
1. The keystore specified in your command was not found
    * Check the keystoreFilePath in *server.xml*
1. The keystore specified in your command could not be opened due to permissions issues

#### Solution 1

1. Ensure that the keystore is non-empty
    * This can be done by listing the certificates within the keystore
    * `keytool -list -v -keystore /path/to/your/keystore`
1. Ensure that *keystoreFilePath* is correct in your *server.xml* file
1. Ensure that you have the correct permission required to access the keystore
    * Try using your command with sudo `sudo yourcommand`
    * Change the permissions of the keystore to allow your user access

---

```bash
FileNotFoundException: .openamcfg file not found
```

#### Problem 2

This error is a result of the OpenAM configuration tool attempting to create an OpenAM configuration file at the end of the configuration process. The full stack trace for this error can be found in the install.log file located in your OpenAM webapp configuration directory. (e.g. `/opt/tomcat/webapps/ace/install.log`)

#### Solution 2

After you install Tomcat but before you run the OpenAM configuration tool, make sure you change ownership of `/opt/tomcat` to the tomcat user. `sudo chown tomcat /opt/tomcat/`

---

#### Problem 3

When running the installation scripts, the installation hangs when attempting to download an external file. (e.g. wget'ing tomcat) This may be caused by the proxy environment variables not being kept when running the scripts with sudo.

#### Solution 3

Add the following line to your /etc/sudoers file:

`Defaults env_keep+="https_proxy http_proxy"`

---

#### Problem 4

A connection error/refusal occurs when accessing OpenAM

#### Solution 4

This error can be related to a couple of things:

1. Keystore issues
    * Refer to the error mentioned previously concerning keystores
1. An incorrect `server.xml` *keystoreFilePath*
1. Ensure that there are 3 levels in your Fully Qualified Domain Name (FQDN)
    * OpenAM requires a 3-level FQDN (e.g. **Valid**: example.domain.com **Invalid**: example.com)
1. Ensure that your SSL ports match up between your `server.xml` file and your `config.properties` file.

---

#### Problem 5

An HTTPS handshake error occurs

#### Solution 5

Ensure that the certificate is located in the specified keystore and that the certificate is correct

---

#### Problem 6

When running the required setup script before creating users in OpenAM, an error occurs stating that the JAVA_HOME environment variable is not set.

#### Solution 6

This error is due to environment variables not being maintained when running the script as sudo. You can maintain environment variables by passing in the -E flag `sudo -E python create_users.py`

* You can also add retain the *JAVA_HOME* environment variable by adding the following line to /etc/sudoers:
  * `Defaults env_keep+="JAVA_HOME"`

---

#### Problem 7

Running the `oam_installer.py` script results in an error that says:

```Configuration Failed.  The server returned error code :500 Internal Server Error.```

#### Solution 7

##### Previous OpenAM exists

This error could be caused if OpenAM was previously installed. Look in the home folder of a user that installed OpenAM previously. If you find a directory named `.openamcfg`, delete it and its contents. Then follow the [Reinstallation of OpenAM (optional)](#Reinstallation-of-OpenAM-(optional)) instructions above. Also see the installation log file `/opt/tomcat/webapps/ace/install.log` and the tomcat log files in  `/opt/tomcat/logs` for errors.

##### A tomcat users already exists

Another cause of this error is existence of a `tomcat` user from a previous installation.  See the installation log file `/opt/tomcat/webapps/ace/install.log` and the tomcat log files in  `/opt/tomcat/logs` for errors. Delete that `tomcat` user and the `tomcat` folder and try again:

```bash
$  userdel -r tomcat
$
$  rm -rf /opt/tomcat
```

##### Low disk space

Low disk space will prevent OpenAM from deploying. Make sure the disk has sufficient disk space to run OpenAM. See the installation log file `/opt/tomcat/webapps/ace/install.log` and the tomcat log files in  `/opt/tomcat/logs` for errors.

---

#### Problem 8

General debugging tip - run `tail -f /opt/tomcat/logs/catalina.out`, this will provide information about Tomcat errors.

---

#### Problem 9

NGINX is returning a page not found error when trying to access OpenAM URL from the browser.

#### Solution 9

Make sure the OpenAM NGINX route in `/etc/nginx/nginx.conf` matches the base name of this installation. For example, `/ace` <==> `ace`.

---

#### Problem 10

Access error when accessing OpenAM or ACE Direct through the browser. You may see a web page that says `UNABLE TO LOGIN TO OPENAM`. You may receive an NGINX error page `nginx error! - The page you are looking for is temporarily unavailable. Please try again later.`

#### Solution 10

Check if your original installation certs in `/root/iam/ssl` have expired:

```bash
$  cd /root/iam/ssl
$    # note the expiration date of this command. if expire, both cert.pem and key.pem must be updated
$  openssl x509 -enddate -noout -in cert.pem
$
```

If the certs are expired, update the certs in `/root/iam/ssl` then follow these instructions:

```bash
$  sudo su - root
$  service tomcat stop
$  ps -aef | grep tomcat  # make sure tomcat is stopped
$  rm /root/iam/ssl/.keystore  # remove local keystore in case corrupt
$  rm /opt/tomcat/.keystore  # remove working keystore to
$  rm /root/iam/ssl/cert.p12
$  cd /root/iam/scripts
$  python keystore.py
$  cp -p ../ssl/.keystore /opt/tomcat/.keystore
$  service tomcat start
$  # on your NGINX servfer, restart nginx
$  # on your ACE Direct Node server, restart ACE Direct node servers
$
```

---

#### Problem 11

OpenAM is already installed and running, but it is necessary to change the OpenAM admin password.

#### Solution 11

Change the OpenAM password:

* Assuming the new password is `password2`, admin username is `amadmin`, and the current password is in the `pwd.txt` file...

    ```bash
    $  # log into OpenAM server as root
    $  cd /root/iam/config/oam/SSOAdminTools-13.0.0/ace/bin
    $  ./ssoadm set-identity-attrs -t User -e / -i amAdmin -u amadmin -f pwd.txt -a userpassword=password2
    $
    $  chmod 755 pwd.txt
    $  echo password2 > pwd.txt
    $  chmod 400 pwd.txt
    $
    $  # test out new password
    $  ./ssoadm list-servers -u amadmin -f pwd.txt
    $
    ```

* Update the value for `ADMIN_PWD` in `/root/iam/config/oam/config.properties` to reflect the new OpenAM admin password, in case of a future reinstallation.
* Update the `openam:password` value in `dat/config.json` on the ACE Direct server, with the new OpenAM admin password, and restart the Node servers:

```bash
"openam": {
    ...
    "password": "password2
```

---

#### Problem 12

ACE Direct agents and managers redirect to the OpenAM login page instead of ACE Direct. ACE Direct agent and manager cannot log in on the same laptop.

#### Solution 12

Configure the successful login URLs for agents and managers. See the _Configure success login URLs_ section above.

---

#### Problem 14

During OpenAM configuration, executing `ssoadm` causes the following error:

```bash
#  ./ssoadm list-servers -u amadmin -f pwd.txt

Logging configuration class "com.sun.identity.log.s1is.LogConfigReader" failed
com.sun.identity.security.AMSecurityPropertiesException: AdminTokenAction: FATAL ERROR: Cannot obtain Application SSO token.
```

#### Solution 14

Resolution: it is likely that the certificates in `/root/iam/ssl/` are expired or invalid. Make sure `cert.pem` and `key.pem` are valid, not expired, and have appropriate permissions.

---

#### Problem 15

During OpenAM configuration, executing `ssoadm` causes the following error:

```bash
# ./ssoadm list-servers -u amadmin -f pwd.txt

https://aceopenam.domain.com:8443/ace
Exception in thread "SystemTimer" java.lang.Error: java.lang.ExceptionInInitializerError
    at com.sun.identity.common.TimerPool$WorkerThread.run(TimerPool.java:542)
Caused by: java.lang.ExceptionInInitializerError
    at com.sun.identity.idm.IdRepoListener.getChangedIds(IdRepoListener.java:278)
    at com.sun.identity.idm.IdRepoListener.objectChanged(IdRepoListener.java:174)
    at com.sun.identity.idm.remote.IdRemoteEventListener.sendIdRepoNotification(IdRemoteEventListener.java:315)
    at com.sun.identity.idm.remote.IdRemoteEventListener$NotificationRunnable.run(IdRemoteEventListener.java:398)
    at com.sun.identity.common.TimerPool$WorkerThread.run(TimerPool.java:434)
Caused by: java.lang.IllegalStateException: CachedConnectionPool is already closed
    at org.forgerock.opendj.ldap.CachedConnectionPool.getConnectionAsync(CachedConnectionPool.java:802)
    at org.forgerock.opendj.ldap.CachedConnectionPool.getConnection(CachedConnectionPool.java:789)
    at com.sun.identity.sm.ldap.SMDataLayer.getConnection(SMDataLayer.java:107)
    at com.sun.identity.sm.ldap.SMSLdapObject.getConnection(SMSLdapObject.java:574)
    at com.sun.identity.sm.ldap.SMSLdapObject.read(SMSLdapObject.java:274)
    at com.sun.identity.sm.SMSEntry.read(SMSEntry.java:699)
    at com.sun.identity.sm.SMSEntry.read(SMSEntry.java:676)
    at com.sun.identity.sm.SMSEntry.<init>(SMSEntry.java:469)
    at com.sun.identity.sm.CachedSMSEntry.getInstance(CachedSMSEntry.java:383)
    at com.sun.identity.sm.ServiceConfigImpl.checkAndUpdatePermission(ServiceConfigImpl.java:646)
    at com.sun.identity.sm.ServiceConfigImpl.getInstance(ServiceConfigImpl.java:529)
    at com.sun.identity.sm.ServiceConfigImpl.getSubConfig(ServiceConfigImpl.java:231)
    at com.sun.identity.sm.ServiceConfig.getSubConfig(ServiceConfig.java:302)
    at com.sun.identity.idm.IdUtils.initialize(IdUtils.java:140)
    at com.sun.identity.idm.IdUtils.<clinit>(IdUtils.java:116)
    ... 5 more
#
```

#### Solution 15

Resolution: you probably issued the command too soon. The server was not ready. Wait `30` seconds and execute the command again.

---

#### Problem 16

Running the `ssoadm` tool causes Java exceptions...

```bash
[root@qaauth bin]# ./ssoadm set-attr-defs -s validationService -t organization -u amadmin -f pwd.txt -a openam-auth-valid-goto-resources="https://dev3demo.***REMOVED***/*" openam-auth-valid-goto-resources="https://dev3demo.***REMOVED***/*?*"

Schema attribute defaults were set.
Exception in thread "SystemTimer" java.lang.Error: java.lang.ExceptionInInitializerError
    at com.sun.identity.common.TimerPool$WorkerThread.run(TimerPool.java:542)
Caused by: java.lang.ExceptionInInitializerError
    at com.sun.identity.idm.IdRepoListener.getChangedIds(IdRepoListener.java:278)
    at com.sun.identity.idm.IdRepoListener.objectChanged(IdRepoListener.java:174)
    at com.sun.identity.idm.remote.IdRemoteEventListener.sendIdRepoNotification(IdRemoteEventListener.java:315)
    at com.sun.identity.idm.remote.IdRemoteEventListener$NotificationRunnable.run(IdRemoteEventListener.java:398)
    at com.sun.identity.common.TimerPool$WorkerThread.run(TimerPool.java:434)
Caused by: java.lang.IllegalStateException: CachedConnectionPool is already closed
...
```

#### Solution 16

The `ssoadm` tool/server may not be ready. Wait a minute or two, then try it again.

---

---

#### Problem 17

When navigating to NGINX to reach the OpenAM server, the following error is seen in the browser:

```bash
An error occurred.
Sorry, the page you are looking for is currently unavailable.
Please try again later.

If you are the system administrator of this resource then you should check the error log for details.

Faithfully yours, nginx.
```

#### Solution 17

Make sure nginx has the correct FQDN and PORT NUMBER for the OpenAM server. Make sure nginx server can ping the private IP address of the OpenAM server. Make sure the nginx server's /etc/hosts file has an entry for the private IP address of the OpenAM server.

---

#### Problem 18

Access error when accessing OpenAM or ACE Direct through the browser. You may see a double URL in the address bar.

#### Solution 18

Make sure a firewall is not blocking incoming access to the OpenAM port (e.g., `8443`). For example, disable `firewalld` on the OpenAM server or add a rule to allow incoming connections to port `8443`.

---

#### Problem 19

OpenAM won't start. Agent cannot reach portal (no access, double url in address bar). Java version was updated on OpenAM server.

#### Solution 19

When the Java version is updated on the OpenAM server, it is necessary to update configs and environment variables:

1. Find the new java version: `echo $(dirname $(dirname $(readlink -f $(which javac))))`
1. Update the `JAVA_HOME` and `JRE_HOME` values in these files to the new version:

    * `/etc/systemd/system/tomcat.service`
    * `/root/.bashrc`
    * `/root/iam/config/tomcat/tomcat.service`

1. Reload _systemctl_: `systemctl daemon-reload`
1. Start OpenAM: `sudo service tomcat start`

---

