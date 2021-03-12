![](images/acesmall.png)

# ACE Identity and Access Management (IAM) Provisioning Instructions


### Customize Login Page

1. Login Message - Copy DataStore.xml to <path_to_openam>/config/auth/default_en/DataStore.xml
1. HTML Page Title - Copy index.html to <path_to_openam>/XUI
1. Footer, image title - Copy ThemeConfiguration.js to <path_to_openam>/XUI/config

### Create Realm
1. Login as Admin
1. Click "New Realm" button
1. Enter "ace" in the name field and save.

### Self-Registration

#### Provision Self-Registration
1. Login as admin
1. Go to Configuration->Global->User Self Service
1. User Registration (check the following checkboxes)
	* User Registration
	* Email Verification
	* KBA
1. Forgotten Password (check the following checkboxes)
	* Forgotten Password
	* KBA
1. Forgotten Username (check the following checkboxes)
	* Forgotten Username
	* KBA

#### Provision Email Service (DO WE USE THIS?)
1. Login as admin
1. Go to Configuration->Global->email service
1. Provison a valid mail server username and password.
1. Provision a valid email address in "Email from Address"


### Configure Dashboard
1. Login as administrator
1. Select Configuration at the top of the page
1. Select Global tab
1. Click "Dashboard" shown on the page
1. Click "New" button to create a new dashboard app

### Add Agent Portal to Dashboard (ED - Update with Agent Portal Info)
1. Enter "MgtPortal" in the name field
1. Enter the following information:
	* "MgtPortalClass" in the ClassName field
	* "MgtPortal" in the Display Name field
	* Url of the mangement portal in the Login field
	* "MgtPortal" in the Name field
	* "images/login-logo.png" in the icon field
1. Click Save

### Add Management Portal to Dashboard
1. Enter "MgtPortal" in the name field
1. Enter the following information:
	* "MgtPortalClass" in the ClassName field
	* "MgtPortal" in the Display Name field
	* Url of the mangement portal in the Login field
	* "MgtPortal" in the Name field
	* "images/login-logo.png" in the icon field
1. Click Save

### Add Supervisor Portal to Dashboard (ED - Update with Super Portal Info)
1. Enter "MgtPortal" in the name field
1. Enter the following information:
	* "MgtPortalClass" in the ClassName field
	* "MgtPortal" in the Display Name field
	* Url of the mangement portal in the Login field
	* "MgtPortal" in the Name field
	* "images/login-logo.png" in the icon field
1. Click Save

### Add Zendesk Portal to Dashboard
1. Enter "TicketCenter" in the id field
1. Enter the following information:
	* "zendesk" in the ClassName field
	* "zendesk" in the Display Name field
	* Url of Zendesk  in the Login field
	* "zendesk" in the Name field
	* "images/logos/zendesk.png" in the icon field
1. Click Save

### Create Groups
1. Login as admin
1. Select the "ace" realm
1. Select "Subjects" on the left menu
1. Click "Group" button on the Subject Page
1. Click "New" to create a new group
1. Enter "Agent" in the id field and save.
1. Repeat the procedures to add the "Supervisor" group

#### Create the Agent Account
1. Login as admin
1. Select the "ace" realm
1. Select "subjects" on the right hand pan
1. Click "New" button to add a user
1. Enter the agent id (e.g. dagent1) in the id field
1. Enter other related user profile information
1. Click Save

#### Assign Agent to a role
1. On the Subject page, select the new created agent by clicking on the name of the agent
1. Click "Groups" on the new user page
1. Select "Agent" from the list on the left hand side
1. Click "Add" button and save

#### Assign Apps to Agent Dashboard
1. Select the agent account on the Subject Page
1. Click Services tab on the User page
1. Click "Dashboard" link
1. Enter "TicketCenter" in the "New Value" field, then click Add
1. Click Save

#### Create a Supervisor Account
1. Repeat the steps to create an agent account, except entering a supervisor id

##### Assign Role to the Supervisor Account
1. Repeat the steps to assign agent to a role
1. Select the Supervisor role rather than the Agent role

#### Assign Apps to the Supervisor Dashboard
1. Select the supervisor account on the Subject Page
1. Click Services tab on the User page
1. Click "Dashboard" link
1. Enter "TicketCenter" in the "New Value" field, then click Add
1. Enter "MgtPortal" in the "New Value" field, then click Add
1. Click Save

### Enable Knowledge Base Authentication
Knowledge Base authentication allows user to retrieve forgotten username and password by answering security questions created by the users. User may select from a list of pre-defined security questions or create new questions. Follow the steps to enable Knowledge Base Authentication:
1. Login as admin, go to configuration->global->user self service
1. Change min answers to define: 2
1. Change min answers to verify: 2
1. Check “enabled” for forgotten password section
1. Check “KBA”
1. Check "enabled for forgotten username section
1. Check "KBA"
1. Save Changes
