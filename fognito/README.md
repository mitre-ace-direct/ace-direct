# fognito

An authentication server that uses Passport.js and redirects authenticated users to authorized pages.

## prerequisites

* [Node.js LTS](https://nodejs.org/en/)

## building

```bash
$  npm run build
$
```

## setup

Creating initial users:

```bash
$  cd db
$  vi data/users.csv  # optional
$  node driver.js
$
```

## running

```bash
$  npm run start
$
$  npm run dev  # development
$
```

## website

The default is port `1234`:

[https://localhost:1234/](https://localhost:1234/)
