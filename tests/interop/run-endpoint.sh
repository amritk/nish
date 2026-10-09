#!/bin/bash
# The quic-interop-runner's entry point for the Nish server (`server.dockerfile`).
# The runner sets ROLE, TESTCASE and SERVER_PARAMS, and mounts /www and
# /certs. Nish has no client here, so the client role is unsupported (127),
# and the server itself exits 127 for a test case it does not take.
set -e

# The routes through the network simulator, from the endpoint image.
/setup.sh

if [ "$ROLE" != "server" ]; then
  echo "nish: no client role"
  exit 127
fi

echo "Test case: $TESTCASE"
# shellcheck disable=SC2086 # SERVER_PARAMS is the runner's word list
exec /interop-server serve --www /www --certs /certs --testcase "$TESTCASE" --port 443 $SERVER_PARAMS
