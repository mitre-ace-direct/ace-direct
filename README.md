# ace-direct

## Configuration

1. Configuration is a **prerequisite** to building and deploying ACE Direct.
1. The global configuration file is `dat/config.json`. If this is a new deployment, copy `dat/config.json_TEMPLATE` to `dat/config.json`.
1. Update all values in `dat/config.json` to match your environment.

## Setup

Set up your local Node.js environment:

1. Make sure Node.js is already installed.
1. Add `N_PREFIX` to your  `~/.bash_profile`:

  ```bash
  N_PREFIX=$HOME/.n
  PATH=$N_PREFIX/bin:$PATH:$HOME/.local/bin:$HOME/bin
  export PATH N_PREFIX
  ```

1. From a terminal, install Node `n` manager:

  ```bash
  $  cd
  $
  $  . .bash_profile
  $  mkdir .n
  $  npm install -g n
  $  n 12.18.2  # for example
  $  node -v
  ```

## Build

```bash
$  cd ace-direct
$
$  npm run preinstall  # one time
$  npm run build  # build
$  npm run postinstall  # right now, one time
$
$  npm run test  # automated tests
$  npm run lint  # run linting tests
$  npm run clean  # remove all external libs
$  npm run clean:logs  # remove log files
```

## Deploying

ACE Direct services use [pm2](https://pm2.keymetrics.io/) for process management.

```bash
$  cd ace-direct
$
$  # starting
$  pm2 start dat/process.json   # first time
$  pm2 start all  # subsequent times
$  pm2 status  # get status
$
$  # stopping
$  pm2 stop all
$  pm2 stop 0  # stop one, ACE Direct server
$
$  # deleting services
$  pm2 stop all
$  pm2 delete all
```

## Accessing the websites

The URLs depend on your `dat/config.json` settings. Sample ACE Direct URLs are:

* Agent portal: `https://company.fqdn.com/ACEDirect/agent`
* Consumer portal: `https://company.fqdn.com/ACEDirect/call`
* Management portal: `https://company.fqdn.com/ManagementPortal`

## Documentation

See the [docs](docs/) folder for complete documentation, including the user guide and installation manual.

For installation help, see the [docs/installation](docs/installation/) folder. See the [INSTALLATION.md](docs/installation/INSTALLATION.md) file.

## Release Notes

See the [RELEASE](RELEASE.md) notes for ACE Direct version information.
