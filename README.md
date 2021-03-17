# ace-direct

This document describes how to install, configure, and deploy the core ACE Direct servers.

## Prerequisites

1. Please read the complete ACE Direct installation instructions: [INSTALLATION.md](docs/installation/INSTALLATION.md).
1. The target server requires an Internet connection during the build process.
1. Create an ACE Direct user account on the target server.
1. Clone this repo to the target server in the home folder of the ACE Direct user.

## Configuration

1. Configuration **must be completed** prior to building and deploying ACE Direct.
1. The global configuration file is `~/ace-direct/dat/config.json`. If this is a new deployment, copy `~/ace-direct/dat/config.json_TEMPLATE` to `~/ace-direct/dat/config.json` to create the initial file.
1. Update all values in `~/ace-direct/dat/config.json` to match your environment. Many of the default values will work as is.

## Setup

Set up your local Node.js environment:

1. Log into the ACE Direct user account on the target server.
1. Make sure Git is installed: `git --version`
1. Clone _this_ Git repo on the target server in the home folder of the ACE Direct user.
1. Install Node.js locally:

    * Amazon Linux 2 example:

      ```bash
      $  # install NVM
      $  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
      $
      $  . ~/.nvm/nvm.sh
      $  nvm install node
      $
      $  # if prompted, run...
      $  npm config delete prefix
      ```

    * Add the following lines to the _end_ of your  `~/.bash_profile`:

      ```bash
      # for local Node with n manager
      N_PREFIX=$HOME/.n
      PATH=$N_PREFIX/bin:$PATH
      export PATH N_PREFIX
      ```

    * From a terminal, install Node `n` manager and Node.js:

      ```bash
      $  cd
      $
      $  source ~/.bash_profile
      $  mkdir .n
      $  npm install -g n
      $  n 12.18.2  # install Node.js v12.18.2
      $  node -v
      $
      $  # for Windows
      $  npm config set script-shell bash
      ```

1. Install and configure _Redis_. See [Redis Quick Start](https://redis.io/topics/quickstart).

    * When configuring Redis, edit `/etc/redis.conf`. Uncomment the `requirepass somepassword` line. Change `somepassword` to a secret password. Restart Redis.
    * On the target server, edit `~/ace-direct/dat/config.json`. Update the `redis.auth` variable to match `somepassword` from the previous step. Restart the Node.js servers.

1. Install and configure _MongoDB_ locally. See [MongoDB installation instructions](https://docs.mongodb.com/manual/).

## Build

```bash
$  cd ~/ace-direct
$
$  npm install
$  npm run build  # build
$  npm run config
$
$  npm run test  # automated tests
$  npm run lint  # run linting tests
$  npm run clean  # remove all external libs
$  npm run clean:logs  # remove log files
```

## Deploying

### Process management

ACE Direct services use [pm2](https://pm2.keymetrics.io/) for process management.

```bash
$  cd ace-direct
$
$  # starting
$  pm2 start dat/process.json   # first time
$  pm2 start all  # subsequent
$  pm2 restart all  # subsequent
$  pm2 restart 0  # restart just ID 0, for example
$  pm2 status  # get status
$
$  # stopping
$  pm2 stop all
$  pm2 stop 0  # stop one, ACE Direct server
$
$  # restart counters
$  pm2 reset all  # reset all
$  pm2 reset 0  # reset just ID 0
$
$  # deleting services
$  pm2 stop all
$  pm2 delete all
```

### Starting on reboot

To make Node.js servers start on reboot:

```bash
$  cd  ~/ace-direct
$
$  pm2 start dat/process.json  # start all node servers
$  pm2 save
$  pm2 startup
$  # now node.js servers will start on boot
```

## Accessing the websites

The URLs depend on your `dat/config.json` settings. Sample ACE Direct URLs are:

* Agent portal: `https://company.fqdn.com/ACEDirect/agent`
* Consumer portal: `https://company.fqdn.com/ACEDirect/call`
* Management portal: `https://company.fqdn.com/ManagementPortal`

## Documentation

See the [docs](docs/) folder for complete documentation, including the user guide and installation manual.

## Complete installation

For help on the complete installation of ACE Direct and all external components, see the [INSTALLATION.md](docs/installation/INSTALLATION.md) file, as well as other documents in the [docs/installation](docs/installation/) folder.

## Release Notes

See the [RELEASE](RELEASE.md) notes for ACE Direct version information.
