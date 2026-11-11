#!/usr/bin/env bash
# Throwaway certificates for the live suite's `tls` check, made into the
# directory given (created if missing):
#
#   ca.pem                the root the client is pointed at
#   server.pem server.key a leaf for 127.0.0.1 and localhost, signed by ca.pem
#   stranger.pem          a root that signed nothing the server sends
#
# All keys are P-256 and every signature ECDSA with SHA-256, the kinds the
# nish TLS client checks. Nothing here is a secret worth keeping: the keys
# live as long as the run.
#
#   bash tests/postgres/live/tls-certs.sh <dir>
set -euo pipefail
dir="$1"
mkdir -p "$dir"
cd "$dir"
key() { openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$1" 2>/dev/null; }
root() {
  key "$1.key"
  openssl req -x509 -new -key "$1.key" -sha256 -days 2 -subj "/CN=$2" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign" \
    -out "$1.pem"
}
root ca "nish live CA"
root stranger "nish live stranger CA"
key server.key
openssl req -new -key server.key -subj "/CN=localhost" -out server.csr
cat > server.ext <<'EXT'
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=serverAuth
subjectAltName=IP:127.0.0.1,DNS:localhost
EXT
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial \
  -sha256 -days 1 -extfile server.ext -out server.pem 2>/dev/null
chmod 600 server.key
rm -f server.csr server.ext ca.key stranger.key ca.srl
