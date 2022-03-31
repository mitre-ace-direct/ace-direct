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
* The MySQL DB must be deployed and running.
* Use the manager users to administer agents in the Management Portal.

#### Creating an Agent

```bash
$  #install software
$  cd fognito
$  npm install
$
$  cd db
$
$  ./create-user.sh -u "dagent1"  # follow the prompts
$
$  ./create-user.sh -u dagent1 -p yourpassword -f Alice -l Jones -r "AD Agent" -n 888-888-8888 -e aj@mail.com -o "The Org" -x 33001 -y ComplaintsQueue -z GeneralQuestionsQueue  # full batch mode
$
$  ./create-user.sh  -i  # interactive option
$  ./create-user.sh  # help
$
```

#### Creating a Manager

```bash
$  #install software
$  cd fognito
$  npm install
$
$  cd db
$
$  ./create-user.sh -u "manager1"  # follow the prompts 
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
