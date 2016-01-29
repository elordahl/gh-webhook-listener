gh-webhook-processor
====================

This application listens for GH webhooks, and processes them accordingly.  


### Starting the listener
**Start server:** `sudo node server.js`

**Start server as daemon:** `sudo node server.js &> logs/output.log &`


### Commit Message Syntax
"blah blah \<JIRA ISSUE\> blah blah."

**Example:**  _HXEP-100 This is my message_
