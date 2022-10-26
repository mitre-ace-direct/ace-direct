# ACE Fendesk Project

![AD](../images/adsmall.png)

Fendesk is a standalone web server that emulates the [Zendesk](https://www.zendesk.com/) ticketing system for ACE Direct or any client that needs a simple ticketing system. The software only implements the subset of Zendesk RESTful API calls that ACE Direct uses. However, it is expandable to include other API calls.

Fendesk uses a simple storage scheme. It creates, updates, and returns tickets as simple text files. The filename for a ticket follows the same naming convention as Zendesk: `<ticketno>.json` (e.g., 322.json). Fendesk offers RESTful API calls to test connectivity, add/update/delete/retrieve tickets, and search for all tickets with a specified VRS number.

## Deployment

Configuraiton and deployment of this server is part of the overall `ace-direct` installation process. See [../README.md](../README.md) for full details.

### Specific App Configuration

To use this with the esb, the esb must recognize this requester/submitter id: **12223334444**.

### Generating API docs

```bash
$  npm install apidoc -g
$
$  apidoc -i routes/ -o apidoc/
$  node app.js
```

#### Testing

```bash
user@yourmachine:~$  curl -k --request GET https://IP address:port/  # check connectivity

user@yourmachine:~$  curl -k -H "Content-Type: application/json" -X POST -d '{"ticket":{"subject":"television","description":"Big Bang Theory is inaccurate","custom_fields":[{"id":29894948,"value":null},{"id":80451187,"value": 1112223333}],"requester":{"name":"Albert","email":"al@someemail.org","phone":"1112223333","user_fields":{"last_name":"Einstein"}}}}' https://IP address:port/api/v2/tickets.json  # add

user@yourmachine:~$  curl -k -H "Content-Type: application/json" -X PUT -d '{"ticket":{"subject":"television (updated)","description":"Sheldon is funny","custom_fields":[{"id":29894948,"value":123},{"id":80451187,"value":1231231234}],"requester":{"name":"Albert","email":"al@someemail.org","phone":"1112223333","user_fields":{"last_name":"Einstein"}},"status":"new","comment":{"public":true,"body":"this is the comment body"},"resolution":"this is the resolution"}}' https://IP address:port/api/v2/tickets/1.json  # update

user@yourmachine:~$  curl -k --request GET https://IP address:port/api/v2/tickets/1.json  # get

user@yourmachine:~$  curl -k --request DELETE https://IP address:port/api/v2/tickets/1.json  # delete

user@yourmachine:~$  curl -k --request GET https://127.0.0.1:1234/api/v2/search.json?query=fieldvalue:1112223333+type:ticket  # search for all tickets with the vrsnum value as a custom field value
```
