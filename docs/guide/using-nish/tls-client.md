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
`close_notify`. Your loop asks it what it wants with `interest()`:

- `TLS_RECORD_WANT_WRITE`: send `output[outputStart .. outputEnd)` and call
  `consume(sent)`.
- `TLS_RECORD_WANT_READ`: read the socket and hand the bytes to
  `receive(data, off, len)`.
- `TLS_RECORD_DATA`: `read(buf, off, len)` has application data, or the
  server's end of stream.
- `TLS_RECORD_AUTH`: the server's certificate and signature are waiting for
  your verdict (below).
- `TLS_RECORD_DONE`: the connection is over; `alert` says why if it failed.

`write(data, off, len)` sends application data once the handshake is done,
`keyUpdate(requestPeer)` rolls the keys, and `close()` sends `close_notify`.

## Checking the server

The handshake stops after the server's CertificateVerify, in
`TLS_CLIENT_STATE_WAIT_AUTH`, and nothing more is read until you decide.
Checking that the certificate chain leads to a root you trust, that the leaf
names the server, and that `verifySignature()` is a valid signature of
`verifyScheme()` over `verifyContent()` under the leaf's key is your job:
`peerCertificates()` hands you the chain, leaf first. Then call
`authenticate(true)`, or `reject(alert)` to fail the connection with that
alert sent:

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

A client that calls `authenticate(true)` without checking talks to whoever
answered, so never skip it.

## What it offers and refuses

The client offers the three TLS 1.3 cipher suites (AES-128-GCM, AES-256-GCM
and ChaCha20-Poly1305) and X25519 key exchange, and answers a
HelloRetryRequest once. It refuses, with an alert:

- **TLS 1.2 and older.** A server that cannot speak 1.3 fails the handshake.
- **P-256 key exchange.** A server that picks P-256 gets `internal_error`;
  leave `groups` at its default, X25519.
- **Client certificates.** None is offered, so a CertificateRequest is
  `unexpected_message`.
- **Resumption.** A NewSessionTicket is checked and dropped; every connection
  is a full handshake.
