gh-webhook-listener
====================

This application listens for GitHub's webhooks, and will process the received payload accordingly.  Currently, this means it will post commit information to the specified JIRA ticket.

### Starting the listener
**Start server:** `sudo node server.js`

**Start server as daemon:** `sudo node server.js &> logs/output.log &`


### Commit Message Syntax
"Lorem ipsum \<JIRA ISSUE\> dolor sit amet"

**Example:**  _HXEP-100 This is my message_
