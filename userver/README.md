# ACE USERVER Project

![USERVER](images/acesmall.png)

The ACE USERVER is a server that provides a RESTful Web Service API to the ACE database for user information.

> Note: Data in this README is fake.\
> Data included here is for documentation purposes only.

## Deployment

Configuraiton and deployment of this server is part of the overall `ace-direct` installation process. See [../README.md](../README.md) for full details.

## Generating API docs

From the command line, generate docs:

```bash
$  npm install apidoc -g
$
$  apidoc -i routes/ -o apidoc/
$
```

### Testing the Server in AWS

* `curl -k --request GET https://host:port/`
* `curl -k --request GET https://host:port/vrsverify/?vrsnum=1000`
* `curl -k --request GET https://host:port/getallvrsrecs`
* `curl -k -H "Content-Type: application/json" -X PUT -d '{"vrsnum":"1000","fieldname":"last_name","fieldvalue":"Spacey"}'  https://host:port/vrsupdate`
* `curl -k -H "Content-Type: application/json" -X PUT -d '{"vrs":1111111111,"username":"someuser","password":"somepassword","first_name":"Oprah","last_name":"Winfrey","address":"1 Billionaire Way","city":"Beverly Hills","state":"CA","zip_code":"90210","email":"oprah@mail.com","isAdmin":0}' https://host:port/addVrsRec`
* `curl -k -H "Content-Type: application/json" -X POST -d '{"vrs": "1112223333", "password": "somepassword", "first_name": "Clint", "last_name": "Eastwood", "address": "10 Hollywood Blvd", "city": "Los Angeles", "state":"CA", "zip_code":"94821", "isAdmin":0}' https://host:port/updateVrsRec`

## SERVICE API

## vrsverify

_Verify a VRS number._

### URL vrsverify

`/vrsverify/:vrsnum`

### Method vrsverify

`GET`

### URL Params vrsverify

#### Required vrsverify

`vrsnum=[integer]`

#### Optional vrsverify

None

### Data Params vrsverify

None

### Success Response vrsverify

Code: 200

Content:

```bash
{
  "message": "success",
  "data": [{
    "vrs": 1000,
    "username": "someuser",
    "password": "somepassword",
    "first_name": "Rick",
    "last_name": "Grimes",
    "address": "1 Walking Way",
    "city": "Eatontown",
    "state": "NJ",
    "zip_code": "07724",
    "email": "root@comp.org"
  }]
}
```

### Error Response vrsverify

Code: 400 BAD REQUEST, Content: `{"message": "missing vrsnum"}`

Code: 500 INTERNAL SERVER ERROR, Content: `{"message": "mysql error"}`

Code: 404 NOT FOUND, Content: `{"message": "you may not modify this field"}`

Code: 501 NOT IMPLEMENTED, Content: `{"message": "records returned is not 1"}`

### Sample Call vrsverify

`curl -k --request GET https://host:port/vrsverify/?vrsnum=1000`

----

## getallvrsrecs

_Get all the VRS records in the user database._

### URL

`/getallvrsrecs`

### Method getallvrsrecs

`GET`

### URL Params getallvrsrecs

#### Required getallvrsrecs

None

#### Optional getallvrsrecs

None

### Data Params getallvrsrecs

None

### Success Response getallvrsrecs

Code: 200

Content:

```bash
{
  "message": "success",
  "data": [{
    "vrs": 1000,
    "username": "someuser",
    "password": "somepassword",
    "first_name": "Rick",
    "last_name": "Grimes",
    "address": "1 Walking Way",
    "city": "Eatontown",
    "state": "NJ",
    "zip_code": "07724",
    "email": "root@comp.org"
  }, {
    "vrs": 1001,
    "username": "someuser",
    "password": "somepassword",
    "first_name": "John",
    "last_name": "Smith",
    "address": "10 Industrial Way",
    "city": "Eatontown",
    "state": "NJ",
    "zip_code": "07724",
    "email": "jsmith@gmail.com"
  }, ..., {
    "vrs": 1006,
    "username": "someuser",
    "password": "somepassword",
    "first_name": "Root",
    "last_name": "Beer",
    "address": "1 Supermarket Way",
    "city": "Freehold",
    "state": "NJ",
    "zip_code": "07728",
    "email": "root@root.com"
  }]
}
```

### Error Response getallvrsrecs

Code: 500 INTERNAL SERVER ERROR, Content: `{"message": "mysql error"}`

Code: 204 NO CONTENT, Content: `{"message": "vrs number not found"}`

### Sample Call getallvrsrecs

`curl -k --request GET https://host:port/getallvrsrecs`

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

Code: 200, Content: `{"message":"Hello world."}`

### Error Response Test Service

None

### Sample Call Test Service

`curl -k --request GET https://host:port/`

----

## addVrsRec

_Add a new VRS record in the user database._

### URL addVrsRec

`/addVrsRec`

### Method addVrsRec

`PUT`

### URL Params addVrsRec

#### Required addVrsRec

None

#### Optional addVrsRec

None

### Data Params addVrsRec

_Every field must have a corresponding value, except for VRS which is automatically incremented._

```bash
{
  "username": "someuser",
  "password": "somepassword",
  "first_name": "Oprah",
  "last_name": "Winfrey",
  "address": "1 Billionaire Way",
  "city": "Beverly Hills",
  "state": "CA",
  "zip_code": "90210",
  "email": "oprah@mail.com",
  "isAdmin": 0
}
```

### Success Response addVrsRec

Code: 200, Content: `{"message":"success"}`

### Error Response addVrsRec

Code: 400 BAD REQUEST, Content: `{"message":"Missing required field(s)"}`

Code: 500 INTERNAL SERVER ERROR, Content: `{"message": "mysql error"}`

### Sample Call addVrsRec

`curl -k -H "Content-Type: application/json" -X PUT -d '{"username":"someuser1","somepassword1":"password1","first_name":"Oprah","last_name":"Winfrey","address":"1 Billionaire Way","city":"Beverly Hills","state":"CA","zip_code":"90210","email":"oprah@mail.com","isAdmin":0}' https://host:port/addVrsRec`

----

## updateVrsRec

_Update a VRS record in the user database._

### URL updateVrsRec

`/updateVrsRec`

### Method updateVrsRec

`POST`

### URL Params updateVrsRec

#### Required updateVrsRec

None

#### Optional updateVrsRec

None

### Data Params updateVrsRec

_Must input a value for each field except for username and email, which cannot be changed._

```bash
{
  "vrs": "1112223333",
  "password": "somepassword",
  "first_name": "Clint",
  "last_name": "Eastwood",
  "address": "10 Hollywood Blvd",
  "city": "Los Angeles",
  "state": "CA",
  "zip_code": "94821",
  "isAdmin": 0
}
```

### Success Response updateVrsRec

Code: 200, Content: `{"message":"success"}`

### Error Response updateVrsRec

Code: 400 BAD REQUEST, Content: `{"message":"Missing required field(s)"}`

Code: 500 INTERNAL SERVER ERROR, Content: `{"message": "mysql error"}`

### Sample Call updateVrsRec

`curl -k -H "Content-Type: application/json" -X POST -d '{"vrs": "1112223333", "password": "somepassword", "first_name": "Clint", "last_name": "Eastwood", "address": "10 Hollywood Blvd", "city": "Los Angeles", "state":"CA", "zip_code":"94821", "isAdmin":0}' https://host:port/updateVrsRec`

## getuserinfo

_Get a user record from the VRS database._

### URL getuserinfo

`/getuserinfo`

### Method getuserinfo

`GET`

### URL Params getuserinfo

#### Required getuserinfo

`username`

#### Optional getuserinfo

None

### Success Response getuserinfo

Code: 200, Content: `{ "message": "success", "data": [ { "vrs": 0, "first_name": "First", "last_name": "Last", "address": "1 Some Street", "city": "Some City", "state": "XX", "zip_code": "00000", "email": "someuser@mail.com", "isAdmin": 0 } ]}`

### Error Response getuserinfo

Code: 400 BAD REQUEST, Content: `{"message":"missing username"}`

Code: 500 INTERNAL SERVER ERROR, Content: `{"message": "mysql error"}`

### Sample Call getuserinfo

`curl -k --request GET https://host:port/getuserinfo?username=someuser`
