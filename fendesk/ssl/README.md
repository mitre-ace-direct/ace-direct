# This folder contains sample .pem files. Use your own certified .pem files for production.

For testing purposes, create self-signed certs `cert.pem` and `key.pem` in this folder and use them in [../../dat/config.json](../../dat/config.json).j

To create the self-signed certs:

```bash
$  # execute this command and answer all questions:
$  openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 358000 -out cert.pem
$
```
