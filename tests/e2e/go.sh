#!/bin/sh
# Starts the harness server on a fresh temp database, runs the browser scenarios, stops the server.
cd "$(dirname "$0")/../.." || exit 1
node tests/e2e/build.mjs || exit 1
node --import ./tests/helpers/register.mjs tests/e2e/server.mjs > /tmp/e2e-server.log 2>&1 &
SERVER=$!
sleep 2
node tests/e2e/run.mjs
CODE=$?
kill $SERVER 2>/dev/null
exit $CODE
