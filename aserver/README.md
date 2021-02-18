# ACE ASERVER Project

![ASERVER](images/acesmall.png)

ASERVER is a server that provides a RESTful Web Service API to the ACE database for agent information.

> Note: Data in this file are fake.\
> Data is included for documentation purposes only.

## SSL Configuration

1. ACE software uses SSL which requires a valid key and certificate.
1. The location of the SSL key and certificate is specified in the `dat/config.json` by using the `common:https:certificate` and `common:https:private_key` parameters in the form of folder/file (e.g., `/home/centos/ssl/mycert.pem` and `/home/centos/ssl/mykey.pem`).
1. Additional information can be found in the ACE Direct Platform Release documentation.

## Getting Started

To install aserver, follow the README.md file in the autoinstall folder. The instructions for manual install are also provided below for reference.

1. Clone this repository
1. Download and install [Node.js](https://nodejs.org/en/)
1. Install the required Node.js modules: cd into the aserver directory, run `npm run build`
1. From the command line, generate docs:

  ```shell
  $  npm install apidoc -g
  $
  $  apidoc -i routes/ -o apidoc/
  $
  ```

## Running the Server manually

```bash
Usage:  
node app.js [ port ]
```

## Testing the Server in AWS (remember to escape any data params)

* `curl -k --request GET "https://*hostname:port*/"`
* `curl -k --request GET "https://*hostname:port*/agentverify/?username=<omitted>&password=<omitted>"`
* `curl -k --request GET "https://*hostname:port*/getallagentrecs"`
* `curl -k -H "Content-Type: application/json" -X POST -d '{"agent_id":25, "first_name": "Marie", "last_name": "C.", "role": "Manager", "phone": "444-444-4444", "email": "administrator@portal.com", "organization": "Organization Zulu", "is_approved": 0, "is_active": 0 }' "https://hostname:port/updateProfile"`

## SERVICE API

## agentverify

_Verify an agent ID and password._

### URL

`/agentverify/?username=someuser&password=somepassword`

### Method

`GET`

### URL Params

#### Required

```bash
username=[string]
password=[string]
```

#### Optional

None

### Data Params

None

### Success Response

Code: 200

Content:

```bash
{
  "message": "success",
  "data": [{
    "agent_id": 1,
    "username": "<omitted>",
    "first_name": "Ed",
    "last_name": "Jones",
    "role": "manager",
    "phone": "222-000-0000",
    "email": "ed@portal.com",
    "organization": "Organization Bravo",
    "extension": 0001,
    "extension_secret": "<omitted>",
    "queue_name": "GeneralQuestionsQueue",
    "soft_extension": 0002,
    "soft_queue_name": "ComplaintsQueue"
  }]
}
```

### Error Response

Code: 400 BAD REQUEST, Content: `{"message": "missing username"}`

Code: 400 BAD REQUEST, Content: `{"message": "missing password"}`

Code: 404 NOT FOUND, Content: `{"message": "username number not found"}`

Code: 500 INTERNAL SERVER ERROR, Content: `{"message": "mysql error"}`

Code: 501 NOT IMPLEMENTED, Content: `{"message": "records returned is not 1"}`

### Sample Call

`curl -k --request GET https://hostname:port/agentverify/?username=someuser&password=somepassword`

----

## getallagentrecs

Get all the agent records in the agent database.

### URL getallagentrecs

`/getallagentrecs`

### Method getallagentrecs

`GET`

### URL Params getallagentrecs

#### Required getallagentrecs

None

#### Optional getallagentrecs

None

### Data Params getallagentrecs

None

### Success Response getallagentrecs

Code: 200

Content:

```bash
{
  "message": "success",
  "data": [{
    "agent_id": 0,
    "username": "user0",
    "first_name": "Kevin",
    "last_name": "Spacey",
    "role": "administrator",
    "phone": "000-000-0000",
    "email": "admin@portal.com",
    "organization": "Organization Alpha",
    "is_approved": 1,
    "is_active": 1,
    "extension": 5010,
    "extension_secret": "secret0",
    "queue_name": "ComplaintsQueue",
    "soft_extension": 6000,
    "soft_queue_name": "ComplaintsQueue"
  }, {
    "agent_id": 1,
    "username": "user1",
    "first_name": "Ed",
    "last_name": "Jones",
    "role": "manager",
    "phone": "222-000-0000",
    "email": "ed@portal.com",
    "organization": "Organization Bravo",
    "is_approved": 1,
    "is_active": 1,
    "extension": 5011,
    "extension_secret": "secret1",
    "queue_name": "GeneralQuestionsQueue",
    "soft_extension": 6000,
    "soft_queue_name": "ComplaintsQueue"
  }, {
    "agent_id": 28,
    "username": "user28",
    "first_name": "Mark",
    "last_name": "Johnson",
    "role": "agent",
    "phone": "",
    "email": "mjohnson123@company.com",
    "organization": "My Organization",
    "is_approved": 0,
    "is_active": 1,
    "extension": 9012,
    "extension_secret": "secret28",
    "queue_name": "Queue1010",
    "soft_extension": 6000,
    "soft_queue_name": "ComplaintsQueue"
  }]
}
```

### Error Response getallagentrecs

Code: 204 NO CONTENT, Content: `{'message': 'agent_id number not found'}`

Code: 400 BAD REQUEST, Content: `{'message': 'missing agent_id'}`

Code: 400 BAD REQUEST, Content: `{'message': 'missing password'}`

Code: 404 NOT FOUND, Content: `{'message': 'agent_id not found'}`

Code: 500 INTERNAL SERVER ERROR, Content: `{'message': 'mysql error'}`

Code: 501 INTERNAL SERVER ERROR, Content: `{'message': 'records returned is not 1'}`

### Sample Call getallagentrecs

`curl -k --request GET https://host:port/getallagentrecs`

----

## getagentrec

Get an agent record from the agent database.

### URL getagentrec

`/getagentrec/:username`

### Method getagentrec

`GET`

### URL Params getagentrec

`username`

#### Required getagentrec

None

#### Optional getagentrec

None

### Data Params getagentrec

None

### Success Response getagentrec

Code: 200

Content:

```bash
{
  "message": "success",
  "data": [{
    "agent_id": 0,
    "username": "user0",
    "first_name": "Kevin",
    "last_name": "Spacey",
    "role": "administrator",
    "phone": "000-000-0000",
    "email": "admin@portal.com",
    "organization": "Organization Alpha",
    "is_approved": 1,
    "is_active": 1,
    "extension": 5010,
    "extension_secret": "secret0",
    "queue_name": "ComplaintsQueue",
    "soft_extension": 6000,
    "soft_queue_name": "ComplaintsQueue"
  }]
}
```

### Error Response getagentrec

Code: 500 INTERNAL SERVER ERROR, Content: `{'message': 'mysql error'}`

Code: 200 INTERNAL SERVER ERROR, Content: `{'message': 'no agent records','data': ''}`

### Sample Call getagentrec

`curl -k --request GET https://host:port/getagentrec/user1`

----

## Test Service

_This is just a test service to quickly check the connection._

### URL Test Service

`/`

### Method Test Service

`GET`

### URL Params Test Service

None

#### Required Test Service

None

#### Optional Test Service

None

### Data Params Test Service

None

### Success Response Test Service

Code: 200

Content: `{ "message": "Hello world from the updated agent portal." }`

### Error Response Test Service

None

### Sample Call Test Service

`curl -k --request GET https://host:port/`

----

## getscript

_Get a script for a particular type of complaint for a complaint queue._

### URL getscript

`/getscript/?queue_name=queuename`

### Method getscript

`GET`

### URL Params getscript

#### Required getscript

```bash
queue_name=[string]
```

#### Optional getscript

None

### Data Params getscript

None

### Success Response getscript

Code: 200

Content:

```bash
{
  "message": "success",
  "data": [{
    "id": 2,
    "queue_name": "ComplaintsQueue",
    "text": "Hello [CUSTOMER NAME], this is [AGENT NAME] calling from Agent Portal Services. I understand that you have a complaint to discuss with us?",
    "date": "2016-04-01T00:00:00.000Z",
    "type": "Default"
  }, {
    "id": 3,
    "queue_name": "ComplaintsQueue",
    "text": "I see you need to change your profile information...",
    "date": "2017-04-04T00:00:00.000Z",
    "type": "Profile"
  }, {
    "id": 5,
    "queue_name": "ComplaintsQueue",
    "text": "You are new to our system.",
    "date": "2017-04-04T00:00:00.000Z",
    "type": "New"
  }]
}
```

### Error Response getscript

Code: 400 BAD REQUEST, Content: `{"message": "missing type field"}`

Code: 400 BAD REQUEST, Content: `{"message": "missing queue_name field"}`

Code: 404 NOT FOUND, Content: `{"message": "script not found"}`

Code: 500 INTERNAL SERVER ERROR, Content: `{"message": "mysql error"}`

### Sample Call getscript

`curl -k --request GET https://host:port/getscript/?queue_name=thequeuename`

----

## getallscripts

_Get all scripts._

### URL getallscripts

`/getallscripts`

### Method getallscripts

`GET`

### URL Params getallscripts

#### Required getallscripts

None

#### Optional getallscripts

None

### Data Params getallscripts

None

### Success Response getallscripts

Code: 200

Content:

```bash
{
  "message": "success",
  "data": [{
    "id": 1,
    "queue_name": "GeneralQuestionsQueue",
    "text": "Hello [CUSTOMER NAME], this is [AGENT NAME] calling from Agent Portal Services. Have I caught you in the middle of anything? The purpose for my call is to help improve our service to customers. I do not know the nature of your complaint, and this is why I have a couple of questions. How do you feel about our service? When was the last time you used our service? Well, based on your answers, it sounds like we can learn a lot from you if we were to talk in more detail. Are you available to put a brief 15 to 20 minute meeting on the calendar where we can discuss this in more detail and share any insight and value you may have to offer?",
    "date": "2016-04-01T00:00:00.000Z",
    "type": "Default"
  }, {
    "id": 2,
    "queue_name": "ComplaintsQueue",
    "text": "Hello [CUSTOMER NAME], this is [AGENT NAME] calling from Agent Portal Services. I understand that you have a complaint to discuss with us?",
    "date": "2016-04-01T00:00:00.000Z",
    "type": "Default"
  }, {
    "id": 3,
    "queue_name": "ComplaintsQueue",
    "text": "I see you need to change your profile information...",
    "date": "2017-04-04T00:00:00.000Z",
    "type": "Profile"
  }, {
    "id": 4,
    "queue_name": "GeneralQuestionsQueue",
    "text": "I see you need to change your profile information...",
    "date": "2017-04-04T00:00:00.000Z",
    "type": "Profile"
  }, {
    "id": 5,
    "queue_name": "ComplaintsQueue",
    "text": "You are new to our system.",
    "date": "2017-04-04T00:00:00.000Z",
    "type": "New"
  }, {
    "id": 6,
    "queue_name": "GeneralQuestionsQueue",
    "text": "You are new to our system.",
    "date": "2017-04-04T00:00:00.000Z",
    "type": "New"
  }]
}
```

### Error Response getallscripts

Code: 404 NOT FOUND, Content: `{"message": "script not found"}`

Code: 500 INTERNAL SERVER ERROR, Content: `{"message": "mysql error"}`

### Sample Call getallscripts

`curl -k --request GET https://host:port/getallscripts`

----

## updateProfile

_Update an agent profile record in the agent database._

### URL updateProfile

`/updateProfile`

### Method updateProfile

`POST`

### URL Params updateProfile

#### Required updateProfile

_None._

#### Optional updateProfile

_None._

### Data Params updateProfile

_Must input a value for each field of the fields shown below:_

```bash
{
  "agent_id": 25,
  "first_name": "Marie",
  "last_name": "C.",
  "role": "Manager",
  "phone": "444-444-4444",
  "email": "administrator@portal.com",
  "organization": "Organization Zulu",
  "is_approved": 0,
  "is_active": 0
}
```

### Success Response updateProfile

Code: 200, Content: `{"message":"success"}`

### Error Response updateProfile

Code: 400 BAD REQUEST, Content: `{"message":"Missing required field(s)"}`

Code: 500 INTERNAL SERVER ERROR, Content: `{"message": "mysql error"}`

### Sample Call updateProfile

`curl -k -H "Content-Type: application/json" -X POST -d '{"agent_id":25, "first_name": "Marie", "last_name": "C.", "role": "Manager", "phone": "444-444-4444", "email": "administrator@portal.com", "organization": "Organization Zulu", "is_approved": 0, "is_active": 0 }' https://host:port/updateProfile`

----

## addAgents

_Add agents to the agent table. Username and email must be unique. If the username or email is already in the table, the add is ignored._

### URL addAgents

`/addAgents/`

### Method addAgents

`POST`

### URL Params addAgents

#### Required addAgents

None

#### Optional addAgents

None

### Data Params addAgents

For example...

```bash
{
  "data": [{
    "username": "user0",
    "password": "pass0",
    "first_name": "Kevin",
    "last_name": "Spacey",
    "role": "administrator",
    "phone": "000-000-0000",
    "email": "admin0@portal.com",
    "organization": "Organization Alpha",
    "is_approved": 1,
    "is_active": 1,
    "extension_id": 0,
    "queue_id": 0,
    "queue2_id": 1
  }, {
    "username": "user1",
    "password": "pass1",
    "first_name": "Stephen",
    "last_name": "Baldwin",
    "role": "manager",
    "phone": "111-111-111",
    "email": "manager1@portal.com",
    "organization": "Organization Beta",
    "is_approved": 0,
    "is_active": 0,
    "extension_id": 1,
    "queue_id": 2,
    "queue2_id": 3
  }, {
    "username": "user2",
    "password": "pass2",
    "first_name": "Benicio",
    "last_name": "Del Toro",
    "role": "csr",
    "phone": "222-222-2222",
    "email": "csr2@portal.com",
    "organization": "Organization Gamma",
    "is_approved": 1,
    "is_active": 1,
    "extension_id": 2,
    "queue_id": 4,
    "queue2_id": 5
  }]
}
```

### Success Response addAgents

Code: 200

Content:

```bash
{
  "message": "Success!"
}
```

### Error Response addAgents

_Sent in Success Response._

### Sample Call addAgents

`curl -k -H "Content-Type: application/json" -X POST -d '{"data":[{"username":"user0","password":"pass0","first_name":"Kevin","last_name":"Spacey","role":"administrator","phone":"000-000-0000","email":"admin0@portal.com","organization":"OrganizationAlpha","is_approved":1,"is_active":1,"extension_id":0,"queue_id":0,"queue2_id":1},{"username":"user1","password":"pass1","first_name":"Stephen","last_name":"Baldwin","role":"manager","phone":"111-111-111","email":"manager1@portal.com","organization":"OrganizationBeta","is_approved":0,"is_active":0,"extension_id":1,"queue_id":2,"queue2_id":3}]}' https://IP address:port/addAgents`

