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

### Creating initial users

* This only updates the interal MongoDB database for `fognito`.
* The `User` collection must be in sync with the ACE Direct MySQL `agent_data` table.
  * The [app/models/users.js](app/models/user.js) contains the `local` _userSchema_. The `id` field is the foreign key into the ACE Direct MySQL `agent_data` table.
  * The ACE Direct Management Portal maintains the MongoDB _userSchema_.

Add, query, delete users:

```bash
$  cd db
$
$  # add/update users info:
$  vi data/users.csv  # or copy from data/users.csv_TEMPLATE
$
$  # add all users in users.csv
$  node driver.js
$
$  # query users
$  node doc-get.js users
$
$  # delete all users
$  node doc-delete.js users
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

The default is port `9010`:

Local testing:
[https://localhost:9010/](https://localhost:9010/)

NGINX testing:
[https://portal.domain.com/ace](https://portal.domain.com/ace)
