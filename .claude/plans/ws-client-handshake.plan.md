---
name: WebSocket client opening handshake
overview: Give nish/net/websocket the client half of the RFC 6455 opening handshake. It writes a GET upgrade request with a caller-drawn random Sec-WebSocket-Key, checks the 101 response and Sec-WebSocket-Accept, and negotiates subprotocols. It runs over the std HTTP/1.1 client and TLS client that other sessions are building, and starts only once both are on main.
stages:
  - id: ws-client
    title: "feat(runtime): client side of the WebSocket opening handshake"
    goal: A Nish program can open a WebSocket as a client over plain TCP or TLS, with a random key, a checked 101 and accept, and a negotiated subprotocol, and then frame with the masking code that already exists
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js net_websocket && node tests/run.js net_loopback && node tests/run.js fuzz && node scripts/security-scope.mjs && node docs/check-links.mjs
    status: pending
    todos:
      - id: http1-upgrade-opt-in
        content: Give std/net/http1-client.ts an explicit, per-request upgrade opt-in so a client can write Connection Upgrade and read a 101 as HTTP1_UPGRADE with tunnelBytes(). Without the opt-in, both stay refused. See ws-client, The upgrade opt-in
        status: pending
      - id: client-key
        content: Add websocketClientKey(nonce) to std/net/websocket.ts. It turns 16 caller-drawn bytes into the base64 key, and the module draws no randomness. See ws-client, Key
        status: pending
      - id: upgrade-request
        content: Add websocketUpgradeRequest over the HTTP/1.1 client's request writer. See ws-client, The request
        status: pending
      - id: response-check
        content: Add websocketCheckResponse over the HTTP/1.1 client's response parser. It fails closed, with a distinct result for each refusal. See ws-client, The response check
        status: pending
      - id: server-offer
        content: Add websocketOfferedProtocols so a server can choose from the client's Sec-WebSocket-Protocol list. See ws-client, Subprotocols
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
        content: Extend docs/security/http1.md (scope, the hostile-server threat model, findings) and the docs/security/README.md index. See ws-client, Security record
        status: pending
      - id: ws-guide
        content: Add docs/guide/using-nish/websocket.md with a compiled client example and a route in scalar.config.json, and update standard-library.md, std/README.md, llms.txt and README.md. See ws-client, Docs
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

No client sits underneath it on `main` (base `3e15e91`). `nish/net/http1` has a
request parser and response writers only, and `std/net/tls.ts` is the server
side of TLS 1.3. The only TLS client is test code
(`tests/link/net_loopback/tls-client.ts`). Other sessions are building a std
HTTP/1.1 client and a std TLS client.

## Approach

- **Start after the carriers land.** The stage waits until the std HTTP/1.1
  client (a request-head writer, and a response parser that gives the status,
  the fields and the bytes after the head) and the std TLS client are both
  merged to `main`. It builds on whatever they export, and adds no second
  request writer, response parser or TLS client. The names this plan uses for
  them are placeholders. Both have landed: #1013 (`nish/net/http1-client`)
  and #1018/#1029 (`nish/net/tls/client`, `nish/net/tls-tcp`). The HTTP/1.1
  client refuses an upgrade on purpose: its writer refuses a `Connection`
  that lists `upgrade`, and its parser refuses every 101 with
  `HTTP1_E_SWITCH`. The owner agreed (2026-10-30) that this stage also owns a
  narrow opt-in there (see "The upgrade opt-in"). It still adds no second
  request writer, response parser or TLS client.
- **The module stays sans-IO and draws no randomness.** It already takes the
  mask key as an argument, and the handshake nonce follows that rule. That
  keeps `nish/net/websocket` compiling to wasm32. The caller draws both from
  `crypto.getRandomValues`, and the guide shows it doing so.
- **Fail closed, and say why.** Each of RFC 6455 §4.1's client requirements
  is its own refusal, with a result the caller can tell apart. A non-101
  status stays readable so a caller can report a 401 or a redirect.
- **One pull request.** The upgrade opt-in, the key, the request, the
  response check and the server's offer parser are a few hundred lines over
  two modules. The tests, the
  record and the guide page make up the rest.

## ws-client — client side of the opening handshake

**Owns:** `std/net/websocket.ts`, `tests/link/net_websocket/**`,
`tests/link/net_websocket_f64/**`, `tests/link/net_loopback/**`,
`tests/link/net_loopback_f64/**`, `tests/fuzz/targets/websocket*.ts`,
`tests/fuzz/corpus/websocket*/**`, `tests/fuzz/README.md`,
`docs/security/http1.md`, `docs/security/README.md`,
`docs/guide/using-nish/websocket.md` (new),
`docs/guide/using-nish/standard-library.md`, `scalar.config.json`,
`std/README.md`, `llms.txt`, `README.md`, `std/net/http1-client.ts`,
`tests/link/net_http1_client*/**`, `docs/security/http1-client.md`,
`docs/guide/using-nish/http-client.md`, `tests/self/goldens/checked/**`
(generated).

Not owned: the TLS client modules, their tests and records.

### The upgrade opt-in

`nish/net/http1-client` refuses an upgrade by design, and it keeps doing so
by default. This stage adds one explicit opt-in. The API is the worker's to
choose, for example a writer that takes an upgrade token, or an `expect`
flag. Whatever form it takes, it must keep these rules:

- **The writer.** Only a request that opted in may carry `Connection`
  listing `upgrade`, and only together with an `Upgrade` field. A plain
  request that lists it is still `HTTP1_REFUSED`.
- **The parser.** Only after an `expect` that opted in does a 101 answer
  `HTTP1_UPGRADE`. Its status and fields stay readable, and `tunnelBytes()`
  gives the bytes fed past the head, the same way CONNECT already works.
  Without the opt-in, a 101 is still `HTTP1_E_SWITCH`. Under the opt-in, any
  other status is handled as it is today, so a 401 or a 3xx stays readable.
  The parser decides nothing about WebSocket itself:
  `websocketCheckResponse` does that.
- **Tests and record.** `tests/link/net_http1_client` (and its `_f64` twin)
  gains positive checks for the opt-in, and negative checks proving that the
  default still refuses both. The split-point corpus covers a 101 with bytes
  glued to the head. `docs/security/http1-client.md` records the widened
  surface, and `docs/guide/using-nish/http-client.md` names the opt-in and
  points to the WebSocket page.

### Key

`websocketClientKey(nonce: u8[]): string | null` turns exactly 16 bytes into
the 24-character padded base64 key, using the existing `base64StdPadEncode`.
It returns null for any other length. The doc comment says the nonce comes
from `crypto.getRandomValues`, fresh for each connection (RFC 6455 §4.1
item 7).

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

1. Any status other than 101. Redirects are not followed.
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
null when it is malformed. The loopback server uses it to pick.

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

Update the index counts and the fuzz table in `docs/security/README.md`.

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

- **The HTTP/1.1 client and TLS client themselves.** Other sessions own them.
- **Permessage-deflate or any other extension.** The client offers none and
  refuses any in the response.
- **Following redirects, and proxies.** A 3xx is a refusal with its status
  readable.
- **The Autobahn suite's client cases** in the interop job.

## Tests

| Where | Positive | Negative |
| --- | --- | --- |
| `tests/link/net_websocket/checks.ts` (and the `_f64` twin) | the RFC 6455 §1.3 nonce through `websocketClientKey` to accept `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=`; the exact request bytes with and without protocols; offer-list parsing (comma lists, OWS, repeated fields) | one named check per response refusal (1–7 above); a 15- and a 17-byte nonce; a non-token, empty or duplicate protocol; CR or LF in the host, the target or a protocol; a malformed offer list |
| `tests/link/net_loopback` | `carrier-websocket.ts` drops its hand-written `GET` and fixed key for the new client over the std TLS client against `Http1TlsServer`; a new plain-TCP carrier against `Http1Server` through `tcpConnect`. Keys and masks come from `crypto.getRandomValues`, two connections send different keys, the client offers `chat` and `superchat`, the server picks with `websocketOfferedProtocols`, and the pair echo a message and close with 1000. Expected stdout pins the negotiated protocol | |
| fuzz | a target from response bytes through the HTTP/1.1 client's response parser to `websocketCheckResponse`, with a seed for each refusal and a 101 with frame bytes glued to the head | |

Each check's exact name is the stage's to choose. Grep it in `tests/run.js`
before citing it in the security record.

## Verification

Before the PR, and again after `main` is merged in before it merges:

```bash
npm run check && npm run lint && npm run lint:dead   # read the exit status, never a piped tail
node tests/run.js net_websocket
node tests/run.js net_loopback                       # the full suite is CI's four test shards
node tests/run.js fuzz
node scripts/security-scope.mjs
node docs/check-links.mjs
node tests/self/goldens.js --update && git diff --stat tests/self/goldens   # read the diff
```

Commit subject (the changelog entry):
`feat(runtime): client side of the WebSocket opening handshake`. The body
says what a client now calls and that std still draws no randomness inside
`nish/net/websocket`.

### Run notes for /feature

- **Targeted test command:** `node tests/run.js <section>`.
- **Full suite:** CI's four `test` shards on the current head, per
  [CLAUDE.md](../../CLAUDE.md#definition-of-done). Run a local `npm test` only
  for the exceptions it names.
- **No coverage command.** The owner agreed that the gate is the repo's
  definition of done (an undegraded full suite in CI's `test` shards, the
  targeted sections above, lint, typecheck and the security scope) plus a
  negative test for every refusal.
- **Generated globs:** `tests/self/goldens/checked/**`.
- **Precondition:** the std HTTP/1.1 client and TLS client are on `main`.
  Ledger: amritk/nish#995.

### Acceptance criteria

1. A program on `main` opens a WebSocket client over plain TCP to
   `Http1Server`, echoes a text message and closes with 1000 (a loopback test
   with expected stdout and exit 0).
2. The same over the std TLS client to `Http1TlsServer`.
3. Two connections send different `Sec-WebSocket-Key` values. The RFC 6455
   §1.3 nonce gives accept `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=`.
4. The client offers `chat` and `superchat`, the server picks one from the
   parsed offer, and both report the same protocol. With no offer, no protocol
   field is sent and none is accepted.
5. A hostile response is refused: a non-101 status (still readable), a wrong
   or missing accept, a missing Upgrade or Connection, a protocol that was not
   offered, and any extension. Each refusal is a named check that passes.
6. CR or LF in the host, the target or a protocol is refused, so there is no
   header injection.
7. `node scripts/security-scope.mjs` passes, and `docs/security/http1.md`
   names the new functions and the hostile-server threat model.
8. The `/websocket` guide page's client example compiles under `npm test`.
9. CI's test shards are green and not degraded on `main` after the merge.
