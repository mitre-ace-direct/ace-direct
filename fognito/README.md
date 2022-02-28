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

## customization

1. Logo image - put image in [public/images/custom/](public/images/custom/), then update `config.logo_image` parameter in [config.js](config.js).
1. `config.title1` - primary title on the login page
1. `config.title2` - secondary title on the login page
1. [views/partials/footer.ejs](views/partials/footer.ejs)

## website

The default is port `1234`:

[https://localhost:1234/](https://localhost:1234/)
