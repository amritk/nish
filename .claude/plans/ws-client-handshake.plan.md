---
name: WebSocket client opening handshake
overview: Give nish/net/websocket the client half of the RFC 6455 opening handshake. It writes a GET upgrade request with a caller-drawn random Sec-WebSocket-Key, checks the 101 response and Sec-WebSocket-Accept, and negotiates subprotocols. It runs over the std HTTP/1.1 client and TLS client that other sessions are building, and starts only once both are on main.
stages:
  - id: ws-client
    title: "feat(net): client side of the WebSocket opening handshake"
    goal: A Nish program can open a WebSocket as a client over plain TCP or TLS, with a random key, a checked 101 and accept, and a negotiated subprotocol, and then frame with the masking code that already exists
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js net_websocket && node tests/run.js net_loopback && node tests/run.js fuzz && node scripts/security-scope.mjs && node docs/check-links.mjs
    status: pending
    todos:
      - id: client-key
        content: Add websocketClientKey(nonce) to std/net/websocket.ts. It turns 16 caller-drawn bytes into the base64 key, and the module draws no randomness. See Key
        status: pending
      - id: upgrade-request
        content: Add websocketUpgradeRequest over the HTTP/1.1 client's request writer. See The request
        status: pending
      - id: response-check
        content: Add websocketCheckResponse over the HTTP/1.1 client's response parser. It fails closed, with a distinct result for each refusal. See The response check
        status: pending
      - id: server-offer
        content: Add websocketOfferedProtocols so a server can choose from the client's Sec-WebSocket-Protocol list. See Subprotocols
        status: pending
      - id: ws-client-unit-tests
        content: Add unit and negative checks in tests/link/net_websocket/checks.ts, which the f64 twin also runs. See Tests
        status: pending
      - id: ws-client-loopback
        content: Run the client end to end in tests/link/net_loopback over a plain-TCP carrier and the std TLS client, replacing carrier-websocket.ts's hand-written GET and fixed key. See Tests
        status: pending
      - id: ws-client-fuzz
        content: Fuzz the response check from response bytes through websocketCheckResponse, with a seed corpus. See Tests
        status: pending
      - id: ws-client-record
        content: Extend docs/security/http1.md (scope, the hostile-server threat model, findings) and the docs/security/README.md index. See Security record
        status: pending
      - id: ws-guide
        content: Add docs/guide/using-nish/websocket.md with a compiled client example and a route in scalar.config.json, and update standard-library.md, std/README.md, llms.txt and README.md. See Docs
        status: pending
      - id: ws-client-goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff
        status: pending
---

# WebSocket client opening handshake

## Context

`std/net/websocket.ts` is sans-IO, and its handshake code is server-only today:

- `websocketRequestKey` reads a request through `Http1Parser`.
- `websocketAcceptKey` computes the accept value.
- `websocketUpgradeResponse` writes the 101 response.

Framing already works for either role. `websocketFrame` and
`websocketWriteFrame` take a mask key on each call: null for a server, four
random bytes for a client. `WsDecoder(expectMasked = false, …)` is the client's
decoder.

## Preconditions: work from other sessions

This stage builds on two pieces that other sessions are building and that are
**not on main** when this plan is written (base `3e15e91`):

- **A std HTTP/1.1 client**: a request-head writer, and a response parser
  that gives the status, the fields and the bytes after the head.
- **A std TLS 1.3 client carrier.**

The worker starts only after both have merged. It reads what they export and
builds on that, without adding a second request writer, response parser or
TLS client. The function names in this plan for those pieces (a request
writer, a response parser) are placeholders for whatever they ship. If either
lands without something this stage needs, the worker opens its PR as a draft
and names the gap. It does not build the missing piece itself.

## Stage: ws-client

**Owns:** `std/net/websocket.ts`, `tests/link/net_websocket/**`,
`tests/link/net_websocket_f64/**`, `tests/link/net_loopback/**`,
`tests/link/net_loopback_f64/**`, `tests/fuzz/targets/websocket*.ts`,
`tests/fuzz/corpus/websocket*/**`, `tests/fuzz/README.md`,
`docs/security/http1.md`, `docs/security/README.md`,
`docs/guide/using-nish/websocket.md` (new),
`docs/guide/using-nish/standard-library.md`, `scalar.config.json`,
`std/README.md`, `llms.txt`, `README.md`, `tests/self/goldens/checked/**`
(generated)

Not owned: the HTTP/1.1 client and TLS client modules and their tests and
records. They belong to the other sessions.

### Key

`websocketClientKey(nonce: u8[]): string | null` turns exactly 16 bytes into
the 24-character padded base64 key, using the existing `base64StdPadEncode`.
It returns null for any other length.

The module draws no randomness, just as it already takes the mask key as an
argument. That keeps it sans-IO and still compiling to wasm32. The doc comment
says the nonce comes from `crypto.getRandomValues`, fresh for each connection
(RFC 6455 §4.1 item 7), and the guide example draws it that way.

### The request

`websocketUpgradeRequest(host, target, key, protocols: string[])` is built on
the HTTP/1.1 client's request writer. It writes these fields:

- `GET`, `Host`
- `Upgrade: websocket`, `Connection: Upgrade`
- `Sec-WebSocket-Key`, `Sec-WebSocket-Version: 13`
- `Sec-WebSocket-Protocol`, with the offered list comma-joined, when the list
  is not empty

It refuses:

- a key that fails `websocketKeyIsValid`
- a protocol that is not a token
- an empty or duplicate protocol
- anything that would let a caller's input start a new field or a new request

### The response check

`websocketCheckResponse(response, key, offered: string[])` returns either the
negotiated protocol (`""` for none) or a failure the caller can tell apart. The
worker chooses between a code for each refusal (`WS_HS_*`) and a small result
object, and the guide documents the choice.

It fails closed on each of these (RFC 6455 §4.1, client requirements 1–6):

1. Any status other than 101. The status stays readable so a caller can report
   a 401 or a redirect. Redirects are not followed.
2. A version other than HTTP/1.1.
3. `Upgrade` absent, or not `websocket` (compared case-insensitively).
4. `Connection` absent, or without the `upgrade` token.
5. `Sec-WebSocket-Accept` absent, repeated, or not equal to
   `websocketAcceptKey(key)`.
6. Any `Sec-WebSocket-Extensions` field, since the client offers none.
7. `Sec-WebSocket-Protocol` present when nothing was offered, repeated, a list,
   or not one of `offered`.

After a successful check, the bytes after the head are the first input to
`WsDecoder(false, …)`. The doc comment and the guide both say so. They also
say that every client frame is masked with a fresh key from
`crypto.getRandomValues`.

### Subprotocols

The server side already takes the chosen protocol in
`websocketUpgradeResponse`, but it has nothing to choose from yet.
`websocketOfferedProtocols(p: Http1Parser): string[] | null` parses the
request's `Sec-WebSocket-Protocol` fields. It handles comma lists, optional
whitespace and repeated fields. It returns `[]` when the field is absent and
null when it is malformed.

### Tests

- **`tests/link/net_websocket/checks.ts`** (the `_f64` twin runs the same
  checks):
  - the RFC 6455 §1.3 vector through `websocketClientKey`
  - the exact request bytes
  - each refusal in the response check, as its own named check
  - parsing of the offer list
- **`tests/link/net_loopback`**:
  - `carrier-websocket.ts` drops its hand-written `GET` and fixed key, and
    uses the new client over the std TLS client against `Http1TlsServer`.
  - A new plain-TCP WebSocket carrier does the same against `Http1Server`
    through `tcpConnect`.
  - In both carriers the key and masks are drawn from
    `crypto.getRandomValues`. The client offers two subprotocols, the server
    picks one with `websocketOfferedProtocols`, the client checks it, then
    they echo a message and close cleanly.
  - Expected stdout pins the negotiated protocol.
- **A fuzz target** feeds response bytes through the response parser to
  `websocketCheckResponse`, with a seed for each refusal.

### Security record

Changes to `docs/security/http1.md`:

- The Scope row for `std/net/websocket.ts` gains the new functions, plus
  `websocketAcceptKey` and `websocketKeyIsValid`, which the client now relies
  on.
- The intro covers both roles. It currently says "as far as the server uses
  it".
- The threat model covers a hostile server: a forged accept, a protocol that
  was not offered, an extension, a non-101 response with a body, and frame
  bytes glued to the head.
- Each finding is either fixed with a before-and-after test or recorded as
  open. Every test is named by its exact check string.

Update the index counts in `docs/security/README.md`.

### Docs

Add a guide page, `docs/guide/using-nish/websocket.md`, covering the server
accept that exists today and the new client:

1. Draw the nonce.
2. Write the request.
3. Feed the response.
4. Read the negotiated protocol.
5. Hand the remaining bytes to the decoder.
6. Mask every frame.

The client example over TLS is a compiled fence (`docs/README.md` →
"Writing a guide page"). Add the route `/websocket` to `scalar.config.json`
next to `/http-router`.

Update the `nish/net` rows of `standard-library.md`, `std/README.md`,
`llms.txt` and `README.md` to say the WebSocket module now handles both
handshake roles.

## Out of scope

- The HTTP/1.1 client and TLS client themselves (other sessions).
- Permessage-deflate or any other extension.
- Following redirects, and proxies.
- The Autobahn suite's client cases in the interop job.
