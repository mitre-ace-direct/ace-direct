# fognito

The ACE Direct authentication and authorization server.

## prerequisites

* [Node.js LTS](https://nodejs.org/en/)
* Uses [../dat/config.json](../dat/config.json) parameters

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

## customization

1. [views/partials/footer.ejs](views/partials/footer.ejs)

## website

The default is port `1234`:

[https://localhost:1234/](https://localhost:1234/)
