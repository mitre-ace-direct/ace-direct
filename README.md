# ace-direct

## Configuration

1. Configuration is a **prerequisite** to building and deploying ACE Direct.
1. The global configuration file is `dat/config.json`. If this is a new deployment, copy `dat/config.json_TEMPLATE` to `dat/config.json`.
1. Update all values in `dat/config.json` to match your environment.

## Building

```bash
$  cd ace-direct
$
$  npm run build
```

## Deploying

ACE Direct services use [pm2](https://pm2.keymetrics.io/) for process management.

```bash
$  cd ace-direct
$
$  # starting
$  pm2 start process.json   # first time
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

Agent portal: `https://company.fqdn.com/ACEDirect/agent`
Consumer portal: `https://company.fqdn.com/ACEDirect/call`
Management portal: `https://company.fqdn.com/ManagementPortal`

## Documentation

See the [docs](docs/) folder for complete documentation, including the user guide and installation manual.
