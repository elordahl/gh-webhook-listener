/*jslint indent:2*/
"use strict";

var http = require('http');
var https = require('https');
var crypto = require('crypto');
var fs = require('fs');
var pr = require('properties-reader');

var properties = pr('config');
var listener_port = properties.get('listener.port');
var jira_hostname = properties.get('jira.hostname');
var jira_port = properties.get('jira.port');
var gh_secret = properties.get('github.secret');

var key_path = properties.get('ssl.key');
var cert_path = properties.get('ssl.cert');
var ca_path = properties.get('ssl.ca');

/**
 * Logs things nicely
 */
function log(text) {
  console.log("[" + (new Date()).toLocaleString() + "] " + text);
}


/*
 * This function validates 1) the github headers exist
 * 2) the event type is push
 * 3) the 'secret' is correct
 */
function validate_headers(h, b) {
  var e = h['x-github-event'];
  var secret = h['x-hub-signature'];
  var hash = 'sha1=' + crypto.createHmac('sha1', gh_secret).update(new Buffer(b, 'utf-8')).digest('hex');

  if (!e || e.toLowerCase() !== 'push') { return false; }
  if (!h['x-github-delivery']) { return false; }
  if (!secret || secret !== hash) { return false; }
  return true;
}

/**
 * funciton to extract and validate commit data
 * from GH payload
 */
function validate_commits(data) {
  var commits;
  try {
    commits = JSON.parse(data).commits;
  } catch (e) {
    log('error parsing commit list:' + e);
  }

  if (!commits) {
    commits = [];
  }

  return commits;
}

/*
 * Assembles the message from a single commit payload
 */
function get_msg(commit) {

  var msg = commit.author.name + " <" + commit.author.email + ">\n";
  msg += commit.url + "\n\n" + commit.message + "\n\n";

  commit.added.forEach(function (val) {
    msg += "A\t" + val + "\n";
  });
  commit.removed.forEach(function (val) {
    msg += "D\t" + val + "\n";
  });
  commit.modified.forEach(function (val) {
    msg += "M\t" + val + "\n";
  });

  return msg;
}

/*
 * Check if commit contains JIRA markup
 * and POST information to JIRA issue accordingly
 */
function post_jira(commit) {

  // only write one comment per commit
  if (!commit.distinct) {
    log('commit ' + commit.id + ' is not distinct.  skipping');
    return;
  }

  var regex = /([A-Z]+-\d+)/g;

  // extract all issues - might have dups
  var issue_list = commit.message.match(regex);
  
  // bail out of there are no issues found
  if (!issue_list) {
    return;
  }

  // dedup list
  var unique_issues = issue_list
    .slice() // don't mess with original
    .sort()
    .reduce(function (a, b) {
      if (a.slice(-1)[0] !== b) {
        a.push(b);
      }
      return a;
    }, []);

  // now add a comment to each issue
  unique_issues.forEach(function (issue_id) {

    var post_data =  JSON.stringify({
      'body' : get_msg(commit)
    });

    var post_options = {
      hostname: jira_hostname,
      port: jira_port,
      path: '/rest/api/latest/issue/' + issue_id + '/comment',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': post_data.length
      },
      auth: 'scm:scm4dev'
    };

    var post_req = https.request(post_options, function (res) {
      log("Posting comment to JIRA issue: " + issue_id);
      log("Response Status Code: " + res.statusCode);
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        log('Response Body: ' + chunk + '\n');
      });
    });

    post_req.on('error', function (e) {
      log('problem with request: ' + e.stack);
    });

    post_req.write(post_data);
    post_req.end();
  });
}

//----------------------//

/**
 *Listen for GH payloads
 */
  var options = {
    key: fs.readFileSync(key_path),
    cert: fs.readFileSync(cert_path),
    ca: fs.readFileSync(ca_path)
  };

  var server = https.createServer(options, function (req, res) {
  var body = "";
  req.on('data', function (chunk) {
    body += chunk;
  });

  req.on('end', function () {
    var response_msg = '';
    //Only process POST requests.
    //Will display status for GET requests
    switch (req.method) {
    case "GET":
      response_msg = 'GitHub commit processor is active!\n';
      break;
    case "POST":
      if (validate_headers(req.headers, body)) {
        validate_commits(body).forEach(post_jira);
        response_msg = 'Processed POST!\n';
      } else {
        response_msg = 'Ignored POST!\n';
      }
      break;
    default:
      response_msg = 'Dropping request!\n';
      break;
    }

    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(response_msg);
    log(response_msg);
  });

});

server.on('error', function (e) {
  log('unable to open port ' + listener_port);
  log(e);
  process.exit(-1);
});

server.listen(listener_port, function () {
  log('Server running on port: ' + listener_port);
});
