#!/bin/bash

CWD="$(dirname $0)"
pushd $CWD > /dev/null

LOCAL_URL=https://127.0.0.1
PORT=443
STATUS="$(curl -s -k $LOCAL_URL:$PORT)"

if [ "$STATUS" != "GitHub commit processor is active!" ]; then
  echo Restarting webhook...
  sudo node bin/server.js &> logs/output.log &
  if [ "$?" == "0" ]; then
     echo Done!
  fi
fi

popd > /dev/null

