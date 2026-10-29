# TLS client

`nish/net/tls/client` speaks the client side of TLS 1.3 (RFC 8446): it builds
the ClientHello, reads the server's flight, derives the keys and writes the
Finished. `nish/net/tls/record-client` wraps it in the record layer, so bytes
from a TCP socket go in and bytes to send come out, and once the handshake is
done application data flows both ways. Both are *sans-IO*: they never read a
socket or a clock, so you drive them from your own loop over
[`nish:net`](networking.md). They are written in Nish and imported like any
other library module
([`export` and `import`](../../LANGUAGE.md#export-and-import)).

Most programs want neither directly: `nish/net/tls-tcp`'s `tlsConnect` opens
a TCP connection, runs the handshake, checks the server and hands you a
connected client (below). The rest of the page is for a program that drives
TLS from its own loop or over another transport.

## Connecting: `tlsConnect`

`tlsConnect(addr, serverName, alpn, timeoutMs)` blocks until the handshake
has ended or the time has run out. `addr` is the 18-byte address
[`nish:net`](networking.md) writes with `netAddress`; it is never looked up,
so resolve a name first with [`nish/net/dns`](networking.md#names-nishnetdns).
`serverName` is what the server is checked against and is sent as SNI unless
it is an IP literal; it is always yours, never taken from the address.

```ts nish:ok
import { netAddress } from "nish:net";
import { tlsConnect } from "nish/net/tls-tcp";

export const main = (): number => {
  const addr: u8[] = new Array<u8>(18);
  netAddress(addr, "127.0.0.1", 8443);
  const client = tlsConnect(addr, "localhost", ["http/1.1"], 5000);
  if (!client.open()) {
    console.log(`no connection: ${client.failure()}`);
    return 1;
  }
  const request: u8[] = [71, 69, 84, 32, 47, 10];
  client.write(request, 0, request.length);
  client.close();
  return 0;
};
```

The client it answers is a `TlsTcpClient`. `open()` says whether the
handshake finished; if not, `failure()` says why, and the socket is already
closed:

| `failure()` | Meaning |
| --- | --- |
| `-110` | the time ran out |
| `-111`, `-22`, other negatives | `nish:net`'s error from connecting or reading |
| `42` `bad_certificate` | no certificate, a leaf whose key is not P-256, P-384 or RSA of 2048 bits or more, a leaf that does not name the server you asked for, or a chain broken another way |
| `45` `certificate_expired` | a certificate in the chain is outside its validity |
| `48` `unknown_ca` | the chain does not reach a root you trust |
| `51` `decrypt_error` | the server's signature does not verify under its certificate's key |
| another alert | the server's own, such as `120` when it speaks none of your ALPN protocols |

Once open, `read`, `write`, `keyUpdate`, `shutdown` and `close` answer as the
`nish:net` calls do, and `interest()`, `readable()` and `writable()` let the
client join your own loop (`fd()` is its socket). `tlsConnectWith(addr,
config, trust, timeoutMs)` takes a whole `TlsClientConfig` (to offer P-256,
say) and the roots to trust; `tlsConnect` reads the system's roots on every
call, so a program that connects often reads them once and passes them here.
`new TlsTcpClient(addr, config, trust)` starts
the same connection without blocking, for a loop you already run.

**The server is always checked.** Its signature must verify under its
certificate's key, and its chain must lead to a root you trust, with every
certificate on it valid now and the name you passed in the leaf's
subjectAltName (an IP address against its IP entries; the certificate's
common name is never read). `tlsConnect` trusts the system's roots
(`tlsClientSystemTrust()`, which honours `SSL_CERT_FILE` and
`SSL_CERT_DIR`). To trust others, such as your own CA for a test server,
build the trust from their certificates with `new TlsClientTrust(roots)`
(each an `X509Certificate` from `nish/crypto/x509`), or from a
`nish/crypto/pki-roots` bundle with `tlsClientTrust(roots)`, and pass it to
`tlsConnectWith`. There is no option to skip the check: a server you cannot
authenticate is reached by trusting its root, never around it.

## Starting a handshake

A `TlsClientConfig` names the server (sent as SNI) and the ALPN protocols to
offer, in order of preference. A `TlsClient` takes the config and its
randomness: 32 random bytes for the ClientHello and a 32-byte private key per
key-exchange group. Use a fresh key from a secure random source for every
connection; the fixed bytes below are only for the example:

```ts nish:ok
import { TLS_LEVEL_INITIAL } from "nish/net/tls";
import { TLS_CLIENT_STATE_WAIT_SERVER_HELLO, TlsClient, TlsClientConfig } from "nish/net/tls/client";

const bytes = (start: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < 32; k++) {
    out.push(toU8(start + k));
  }
  return out;
};

export const main = (): number => {
  const config = new TlsClientConfig("example.com", ["h2", "http/1.1"]);
  const client = new TlsClient(config, bytes(1), bytes(0x40), bytes(0x60));
  if (client.start() !== 0) {
    return 1;
  }
  const hello: u8[] = client.takeOutput(TLS_LEVEL_INITIAL);
  console.log(`ClientHello: ${hello.length} bytes`);
  return client.state === TLS_CLIENT_STATE_WAIT_SERVER_HELLO ? 0 : 1;
};
```

`start` answers 0 or a TLS alert number; so does every `receive`. After the
ServerHello the client reads the server's encrypted flight at
`TLS_LEVEL_HANDSHAKE`, and `alpn()` gives the protocol the server picked.

## Over a socket

`TlsRecordClient` takes a started or fresh `TlsClient` and does the rest: the
records, the keys at the right record boundaries, alerts, KeyUpdate and
`close_notify`. Your loop asks it what it wants with `interest()`, whose bits
come from `nish/net/tls/record-server` (the server uses the same ones), except
`TLS_RECORD_AUTH`, which `nish/net/tls/record-client` exports:

- `TLS_RECORD_WANT_WRITE`: send `output[outputStart .. outputEnd)` and call
  `consume(sent)`.
- `TLS_RECORD_WANT_READ`: read the socket and hand the bytes to
  `receive(data, off, len)`.
- `TLS_RECORD_DATA`: `read(buf, off, len)` has application data, or the
  server's end of stream.
- `TLS_RECORD_AUTH`: the server's certificate and signature are waiting for
  your verdict (below).
- `TLS_RECORD_DONE`: the connection is over. If it failed (`state` is
  `TLS_RECORD_STATE_FAILED`), `failure()` says why: the alert the client sent,
  else the server's, else `internal_error` for a failure with no alert, such
  as the connection cut short. `alert` holds only the one the client sent.

`write(data, off, len)` sends application data once the handshake is done,
`keyUpdate(requestPeer)` rolls the keys, and `close()` sends `close_notify`.
A `close()` before the handshake is done also stops reading: the server's
records are dropped and the handshake's secrets are wiped. Once the connection
has failed, data you have not read is gone: `read` answers
`TLS_RECORD_RESET`.

## Checking the server

The handshake stops after the server's CertificateVerify, in
`TLS_CLIENT_STATE_WAIT_AUTH`, and nothing more is read until you decide.
`nish/net/tls/verify`'s `tlsClientAuthenticate(conn, trust, nowMs)` makes
that decision the way `TlsTcpClient` does: the signature under the leaf's
key, then the chain to a root in `trust` for the server's name at `nowMs`,
and the verdict sent. Use it unless you have your own check.

```ts nish:ok
import { TLS_RECORD_AUTH, TlsRecordClient } from "nish/net/tls/record-client";
import { TlsClientTrust, tlsClientAuthenticate } from "nish/net/tls/verify";

export const decide = (conn: TlsRecordClient, trust: TlsClientTrust): i32 => {
  if ((conn.interest() & TLS_RECORD_AUTH) === 0) {
    return 0;
  }
  return tlsClientAuthenticate(conn, trust, toI64(Date.now()));
};

export const main = (): number => 0;
```

A check of your own has to do all of it: that the certificate chain leads
to a root you trust, that the leaf names the server, and that
`verifySignature()` is a valid signature of `verifyScheme()` over
`verifyContent()` under the leaf's key; `peerCertificates()` hands you the
chain, leaf first. Then call `authenticate(true)`, or `reject(alert)` to
fail the connection with that alert sent:

```ts nish:ok
import { TLS_RECORD_AUTH, TlsRecordClient } from "nish/net/tls/record-client";

const BAD_CERTIFICATE: i32 = 42;

// Your chain and signature check goes here.
const trusted = (chain: u8[][]): boolean => chain.length > 0;

export const decide = (conn: TlsRecordClient): void => {
  if ((conn.interest() & TLS_RECORD_AUTH) !== 0) {
    if (trusted(conn.tls.peerCertificates())) {
      conn.authenticate(true);
    } else {
      conn.reject(BAD_CERTIFICATE);
    }
  }
};

export const main = (): number => 0;
```

`authenticate` answers 0 and `reject` the alert it sent; once the connection
has failed, both answer the alert that says why, never 0. A client that calls `authenticate(true)` without checking talks to
whoever answered, so never skip it.

## What it offers and refuses

The client offers the three TLS 1.3 cipher suites (AES-128-GCM, AES-256-GCM
and ChaCha20-Poly1305) and X25519 key exchange, and answers a
HelloRetryRequest once. Add P-256 (`secp256r1`) to the config's `groups` and
a server may pick it instead, in its ServerHello or in a HelloRetryRequest;
the client's third argument is the P-256 private key. It refuses, with an
alert:

- **TLS 1.2 and older.** A server that cannot speak 1.3 fails the handshake.
- **A bad key share.** An X25519 share that gives an all-zero secret, or a
  P-256 share that is not an uncompressed point on the curve, is
  `illegal_parameter`.
- **Client certificates.** None is offered, so a CertificateRequest is
  `unexpected_message`.
- **Resumption.** A NewSessionTicket is checked and dropped; every connection
  is a full handshake.
