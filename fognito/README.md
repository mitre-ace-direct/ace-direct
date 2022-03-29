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

* The `../dat/config.json` **must be configured** before creating users.
* MongoDB must be deployed and running.
* This only updates the interal MongoDB database for `fognito`.
* The `User` collection must be in sync with the ACE Direct MySQL `agent_data` table.
  * The [app/models/users.js](app/models/user.js) contains the `local` _userSchema_. The `id` field is the foreign key into the ACE Direct MySQL `agent_data` table.
  * The ACE Direct Management Portal maintains the MongoDB _userSchema_.
* Use the manager users to administer agents in the Management Portal.

#### Managing All Users

```bash
$  #install software
$  cd fognito
$  npm install
$
$  # add/update all users info:
$  cd db
$  cp data/users.csv_TEMPLATE data/users.csv
$  vi data/users.csv  # make your edits 
$
$  # add all users in users.csv
$  node driver.js
$
$  # delete users.csv
$  rm data/users.csv
$
$  # query users
$  node doc-get.js users
$
$  # delete all users (if needed)
$  node doc-delete.js users
$
```

#### Managing One User

Here is how to add an agent or manager from the command line. This is also useful for changing an users's password. Note that this only adds the user to the `fognito` database. The user must also be in MySQL for login to work.

```bash
$  #install software
$  cd fognito
$  npm install
$
$  cd db
$
$  # add an agent 
$  node create-users.js dagent99 somepassword "AD Agent" dagent99@mail.com "Alice Jones"
$
$  # add a manager
$  node create-users.js manager4 somepassword "Manager" manager4@mail.com "Grace Hopper"
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
