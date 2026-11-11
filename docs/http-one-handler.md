# One handler across HTTP/1.1, 2 and 3 (WP39 G7)

**Status: design note, written before code.** It fixes the API, the
mapping onto the four carriers, Alt-Svc, h2c, the allocation argument and
the tests and security records for two later stages: **g7-h2c**, which adds
`std/net/http2-cleartext.ts`, and **g7-facade**, which adds
`std/net/http-server.ts`. Its parent is [WP39](wp39-http-server.md), and it
answers [wp43 §5 "Why HTTP/2 and HTTP/3 are a follow-up"](wp43-http-app-layer.md#5-the-handler-over-http11).

The plan named this file `docs/wp39-g7-one-handler.md`. `docs/check-links.mjs`
treats every `docs/wp<N>-*.md` as a work package with its own roadmap page,
and G7 is a stage of WP39, not a package, so the note sits beside
[h3-latency.md](h3-latency.md) instead.

## 1. What G7 delivers, and what it touches

A program writes one handler loop. The same loop then serves any mix of
four listeners:

| Listener | Carrier it drives | Port |
| --- | --- | --- |
| HTTP/1.1 cleartext | `Http1Server` (`std/net/http1-server.ts`) | TCP |
| HTTP/2 cleartext (h2c) | **new** `Http2CleartextServer` (`std/net/http2-cleartext.ts`) over `Http2Connection` | TCP |
| HTTP/2 over TLS | `Http2TlsServer` (`std/net/http2-tls.ts`) | TCP |
| HTTP/3 | `Http3Server` (`std/net/http3-server.ts`) | UDP |

### 1.1 Module paths

The stages can be named, and they are:

- **g7-h2c:** `std/net/http2-cleartext.ts`. It is a new carrier over the
  unmodified `std/net/http2.ts`, in the same shape as `http2-tls.ts`, with a
  TCP socket in place of TLS.
- **g7-facade:** `std/net/http-server.ts`. It is the façade over
  `Http1Server`, `Http2TlsServer`, `Http2CleartextServer` and `Http3Server`,
  and it exports `HttpServer`, `HttpServerRequest` and `HttpServerLimits`.

### 1.2 Finding F0: no existing carrier changes

**Neither stage needs a change to an existing carrier.** Both use only API
the carriers already export:

- `Http1Server`: `next`, `connection`, `respond`, `write`, `end`, `flush`,
  `rearm` and `close`.
- `Http2Connection`: `feed`, `inputTail`, `received`, `endInput`, `next`,
  `respond`, `writeData`, `reset`, `consume`, `restart` and `rest`, plus
  `Http2Pools`.
- `Http2TlsServer`: `accept`, `next`, `connection` and `flush`.
- `Http3Server`: `receive`, `ready`, `connection` and `flush`, with
  `Http3Connection`'s `respond`, `writeData` and `reset`.

`http1-server.ts`, `handler.ts` and `serve.ts` belong to in-flight runs
(wp34-finish edits all three), and G7 edits none of them. The four places
where the obvious design *would* need a carrier change are findings F1 to F4
below. Each has a design that avoids the change, and each says what that
design gives up. None of them is an escalation. If an implementing stage
finds that it needs any edit to `http1-server.ts`, `http2.ts`,
`http2-tls.ts`, `http3*.ts`, `handler.ts` or `serve.ts`, that is an
escalation to the plan: the stage stops and reports it, and does not make
the edit.

## 2. The API

Nish has no function values, so this is the pull model of `HttpHandler`
([wp43 §5](wp43-http-app-layer.md#5-the-handler-over-http11)), widened to
four listeners. The program builds a `Router`, configures listeners, and
loops on `wait`, `ready` and `take`, switching on `r.route`.

```ts
import { Router } from "nish/net/router";
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server";
import { HANDLER_DROPPED } from "nish/net/handler";

const router = new Router();
const HELLO = router.add("GET", "/hello");
const ECHO = router.add("POST", "/echo");
const USER = router.add("GET", "/users/:id");

const limits = new HttpServerLimits();
limits.altSvcMaxAge = 86400;

const server = new HttpServer(limits, router);
server.listenHttp1(tcpFd1, new Http1Config(), 256);
server.listenH2c(tcpFd2, new Http2Config(), 64);
server.listenHttp2Tls(tcpFd3, tlsConfig, new Http2Config(), 64);
server.listenHttp3(udpFd, quicConfig, new Http3Config(), 64, entropy);

while (!server.stopped()) {
  server.waitSigned(1000, key);           // wait(ms) when every listener is cleartext
  while (server.ready() > 0) {
    const r: HttpServerRequest = server.take();
    if (r.route === HELLO) {
      server.send(r, 200, TEXT_PLAIN, HELLO_BODY, 0, HELLO_BODY.length);
    } else if (r.route === ECHO) {
      server.send(r, 200, TEXT_PLAIN, r.body, 0, r.bodyLength);
    } else if (r.route === USER) {
      server.sendJson(r, 200, lookup(r.paramDecimal(0)));
    } else {
      server.refuse(r);                   // 404, or 405 with Allow
    }
  }
}
```

### 2.1 Limits

```ts
export class HttpServerLimits {
  requests: i32 = 1024;          // request pool shared by all listeners
  maxBody: i32 = 1048576;        // a request body is held whole; 413 above
  maxHead: i32 = 16384;          // copied head (method, target, fields)
  maxResponseFields: i32 = 32;   // program fields + content-length + alt-svc
  bodyTimeout: i32 = 30000;      // ms from head to whole body
  idleTimeout: i32 = 60000;      // ms an h2/h2c connection may hold no stream
  prefaceTimeout: i32 = 10000;   // ms an h2c peer has to send its 24 bytes
  altSvcMaxAge: i32 = 86400;     // Alt-Svc ma, seconds
  altSvcPort: i32 = 0;           // 0: the QUIC socket's own port
  maxEvents: i32 = 256;
  jsonBytes: i32 = 65536;
}
```

### 2.2 Listeners

```ts
export class HttpServer {
  constructor(limits: HttpServerLimits, router: Router);

  listenHttp1(fd: i32, config: Http1Config, slots: i32): void;
  listenH2c(fd: i32, config: Http2Config, slots: i32): void;
  listenHttp2Tls(fd: i32, tls: TlsServerConfig, config: Http2Config, slots: i32): void;
  listenHttp3(fd: i32, quic: QuicServerConfig, config: Http3Config, slots: i32,
              entropy: u8[]): void;
```

- Each kind of listener can be configured at most once. A second call
  panics.
- `listenHttp3` panics when `config.webtransportSessions > 0`.
- `listenH2c` and `listenHttp2Tls` panic when
  `config.enableConnectProtocol` is set.
- These are configuration mistakes, found at start-up, so they panic and do
  not return a code.

### 2.3 The loop

```ts
  wait(timeoutMs: i32): i32;                         // panics with a TLS or QUIC listener
  waitSigned(timeoutMs: i32, key: Secret<u8[]>): i32; // TLS handshakes, QUIC packets
  watch(fd: i32, id: i32): void;
  fired(): i32;                                      // the program's own fds that fired
  ready(): i32;
  take(): HttpServerRequest;
  hungUp(r: HttpServerRequest): bool;
  stop(): void;                                      // drain, as HttpHandler.drain
  stopped(): bool;
```

- `waitSigned` exists because the TLS and QUIC handshakes sign with the
  server's key, and the key travels as a `Secret`
  ([secret.md](security/secret.md)), the same way `Http2TlsServer.signP256`
  and `Http3Server.receive` take it.
- A server with only cleartext listeners never has to hold a key.
- One `poll` covers every TCP listener, every connection and the UDP socket.
  The timeout is the smaller of `timeoutMs` and `Http3Server.timeout(now)`.
  A fired UDP socket runs `receive` until it has nothing more; then `flush`
  runs.

### 2.4 Answers

The answer methods have the same names and the same return codes as
`HttpHandler`. The codes are imported from `handler.ts`, not redefined:

```ts
  start(r, status: i32, names: u8[][], values: u8[][], bodyLength: i32): i32;
  write(r, buf: u8[], off: i32, len: i32): i32;
  end(r): i32;
  send(r, status: i32, contentType: u8[], body: u8[], off: i32, len: i32): i32;
  sendFields(r, status, names, values, body, off, len): i32;
  empty(r, status: i32): i32;
  json(r): JsonWriter;
  sendJson(r, status: i32, w: JsonWriter): i32;
  problem(r, status: i32, title: u8[]): i32;
  refuse(r): i32;
```

Each returns `HANDLER_SENT` or `HANDLER_DROPPED`, as `HttpHandler` does.

- `bodyLength` follows `HttpHandler`: a length, or `HTTP1_CHUNKED` (-1) for
  a body of unknown length.
- On h2 and h3, an unknown length means the response has no
  `content-length` field, and `end` closes the stream.
- No chunked framing is written on h2 or h3.

### 2.5 The request view

```ts
export class HttpServerRequest {
  route: i32;
  version: i32;         // 1, 2 or 3
  secure: bool;         // h2 over TLS, or h3
  body: u8[];
  bodyLength: i32;
  // methodIs, pathIs, param*, paramDecimal, query, hasQuery, queryIndex,
  // header, valueStart, valueEnd, headerIs: the signatures HttpRequest has.
}
```

**Finding F3: G7 ships its own request type.** The read surface and the head
layout are the same as `HttpRequest` in `handler.ts`: one `head` buffer
holding the method, the target and every field, plus four `spans` per field.
But `HttpRequest`'s fields are documented `@internal` as "filled by
HttpHandler in this module". For the façade to fill them, `handler.ts` would
need a contract change, and that file is in flight.

So G7 adds `HttpServerRequest` in `http-server.ts`. It has the same accessor
names, so a route body moves between the two by changing one type name.
Merging the two types into one is follow-up work, for after wp34-finish and
wp49 land. That follow-up is also where `serve` (the async layer) would sit
over the façade.

## 3. Mapping onto the carriers "without copying"

### 3.1 Request side: one copy in

Every version copies the head once into the request's own `head` buffer.
That copy is the copy `HttpHandler` already makes for HTTP/1.1, and it
cannot be avoided on HTTP/2 or HTTP/3:

- **HTTP/1.1.** At `H1_REQUEST`, the parser's head bytes and spans are
  copied, exactly as `HttpHandler` does.
- **HTTP/2 and h2c.** At `H2_REQUEST`, the request takes `HttpFields`, which
  lives in the connection's HPACK state and is overwritten by the next
  header block on any stream. The copy has a fixed order: `:method`, then
  `:path` as the target, then `:authority` as a `host` field, then each
  regular field except `host` (§9.2). A request with no `:authority`
  keeps its `host` field as sent.
- **HTTP/3.** At `H3_REQUEST`, the request takes the same `HttpFields`
  layout. It is valid only until the next request or trailers on the
  connection, so it is copied the same way.

A zero-copy view of the head is therefore not possible for h2 or h3. "Without
copying" means one copy in, made once, into a buffer that is reused. No head
is parsed a second time: the spans come from the carrier's own parse
(§7.2).

The request is whole, and queued, at these points:

| Version | The request is whole at |
| --- | --- |
| HTTP/1.1 | `H1_END` |
| HTTP/2 | the `REQUEST` or `DATA` event that carries endStream |
| HTTP/3 | `H3_END` |

Body chunks (`H1_BODY`, `H2_DATA` and `H3_DATA`) are appended to `r.body` up
to `maxBody`. Past that, the request is answered 413 and the rest of the
body is not read. The stream is then reset with NO_ERROR on h2 (RFC 9113
§8.1) and stopped with H3_NO_ERROR on h3 (RFC 9114 §4.1), which both allow
after a complete response. Request trailers
(`H2_TRAILERS`, `H3_TRAILERS`) are read and dropped.

### 3.2 Response side: at most one copy out

The program's bytes go straight to the carrier's own call. The façade copies
only what a full window or a full output refuses:

| Call | HTTP/1.1 | HTTP/2 and h2c | HTTP/3 |
| --- | --- | --- | --- |
| head | `Http1Connection.respond(status, names, values, len)` | `Http2Connection.respond(id, status, names, values, len === 0)` | `Http3Connection.respond(id, status, names, values, len === 0)` |
| body | `write` | `writeData(id, buf, off, len, false)` | `writeData(id, buf, off, len, false)` |
| `end` | `end` | `writeData(id, buf, 0, 0, true)` | `writeData(id, buf, 0, 0, true)` |

- On h2 and h3, a known length adds a `content-length` field. The digits
  are written into a per-request scratch array.
- `writeData` returns the bytes it took. The remainder is copied once into
  `r.pending`, and is written again on `H2_WINDOW` (stream id, or 0 for the
  whole connection) or on `H3_WRITABLE`. This is the pattern
  `tests/link/net_interop_server/h2.ts` uses.
- That remainder copy is the only response copy. It is made only when flow
  control holds bytes back.

**AGAIN on a head.** If the carrier's output has no room for a head, the
request is dropped; it is never queued:

- HTTP/1.1 closes the slot, as `HttpHandler.start` does.
- HTTP/2 resets the stream with INTERNAL_ERROR. If even the reset does not
  fit, it closes the connection.
- HTTP/3 resets the stream with H3_INTERNAL_ERROR.

Every case answers `HANDLER_DROPPED`. The ready gate keeps this rare: a
request is handed to the program only when its connection's output has room
for a head, the same rule `HttpHandler` follows.

### 3.3 Streams, slots and late answers

A request remembers where it came from as (listener, slot, slot generation,
stream id). The stream id is an `i64`, because h3 ids are 62-bit; h2 ids fit
in `i32` and are widened.

- **Slot generations.** When a slot closes, its generation is bumped, so an
  answer meant for the old connection is dropped (`HANDLER_DROPPED`) and
  never reaches a new connection on the same slot.
- **Streams.** `H2_RESET`, `H3_RESET` and `H3_STOPPED` mark the stream's
  request as hung up, so `hungUp(r)` reads true and its answer drops.
- **Finding a stream's request.** Each slot has a fixed table of (stream
  id, request index) pairs. Its size is the slot's stream cap
  (`Http2Config.maxStreams`, and QUIC's bidirectional stream limit for h3).
  The table is made at listen time and searched linearly; at 100 entries a
  linear search beats a hash.
- **When the pool is full.** One connection holds at most
  `min(maxStreams, requests / 4)` requests (§9.2). If a stream opens past
  that cap, or the request pool is empty:
  - HTTP/1.1 back-pressures: the carrier does not read the next request.
  - HTTP/2 resets the stream with REFUSED_STREAM (RFC 9113 §8.7), which
    tells the client that the request was not processed and may be retried.
  - HTTP/3 resets the stream with H3_REQUEST_REJECTED (RFC 9114 §8.1),
    which means the same thing.

### 3.4 Timeouts (finding F4)

`Http1Server` has its own head and body deadlines. `Http2Connection` has
none, and neither does the `http2-tls.ts` carrier. The façade enforces two
deadlines itself, using its own clock and each carrier's `close(slot)`:

- **`bodyTimeout`:** the time from a request's head to its last body byte,
  for every version.
- **`idleTimeout`:** how long an h2 or h2c connection may be open with no
  open stream.

`Http3Server` keeps QUIC's own idle timeout. Doing the timing in the façade
avoids a change to `http2.ts`. Neither deadline is enforced when a program
drives `Http2TlsServer` directly, as it is not today.

## 4. h2c: prior knowledge only

`std/net/http2-cleartext.ts` exports `Http2CleartextServer`. It has the same
method names as `Http2TlsServer` (`accept`, `next`, `connection`, `flush`,
`close`, `expire`, `fd`), with a TCP socket in place of the TLS server.

- **Prior knowledge only.** The client starts with the HTTP/2 connection
  preface (RFC 9113 §3.3).
- **No `Upgrade: h2c`.** RFC 9113 §3.1 deprecates it, so the 101
  Switching Protocols path is not built. An HTTP/1.1 request with
  `Upgrade: h2c` that arrives on an h2c port fails the preface check and is
  closed. The same request arriving on the HTTP/1.1 port is served as plain
  HTTP/1.1, with no upgrade.
- **No sniffing.** An h2c port never falls back to HTTP/1.1. A deployment
  that wants both runs two ports.

### 4.1 Finding F1: the preface and "close with no response"

The plan says that a bad preface closes the connection with no response.
`Http2Connection` cannot do that, because:

- it checks the preface itself;
- on a mismatch it calls `fail(H2_PROTOCOL_ERROR)`, which queues SETTINGS
  and a GOAWAY;
- `H2_PREFACE` and `http2IsPreface` are module-private.

The carrier gets the plan's behaviour without editing `http2.ts`:

1. Each slot has a 24-byte preface array and a count. The carrier reads
   from the socket into that array only, and holds its own copy of the
   24-byte constant (`PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n`).
2. On a mismatch, as soon as a byte differs and not after 24 bytes, it
   closes the socket. No byte is sent.
3. On a match it calls `Http2Connection.feed(preface, 0, 24)`. The
   connection then checks the preface again, finds it good, and runs exactly
   as it does under TLS. From then on, input goes through `inputTail()` and
   `received(n)`, as `http2-tls.ts` does.
4. Until the preface is whole, the slot borrows no `Http2Pools` buffer.
   A slow or silent peer holds 24 bytes and a slot. `prefaceTimeout` closes
   it from `expire(now)`.

`Http2Connection.inputEnded` is `@internal` ("read by http2-tls.ts only").
The h2c carrier therefore keeps its own `ended` flag for the EOF it passed
to `endInput()`; it does not read the field.

### 4.2 Finding F2: one TLS port for HTTP/1.1 and HTTP/2

A single TLS port where ALPN chooses between `http/1.1` and `h2` would need
a carrier change. `Http2TlsServer` closes any slot whose ALPN is not `h2`
with close_notify, and it has no way to hand that slot to an HTTP/1.1
server. G7 therefore offers:

- HTTP/1.1 over cleartext `Http1Server` only. `Http1TlsServer` is left out
  of the façade, because a second TLS port for HTTP/1.1 doubles the
  certificate and port setup for little gain.
- HTTP/2 over TLS on its own port.

ALPN fallback on one port is deferred until wp34-finish lands, and it is a
change to `http2-tls.ts` that its owner makes. Behind a TLS-terminating
proxy, which is the common deployment, this costs nothing: the proxy speaks
TLS and talks to h2c or HTTP/1.1 upstream.

## 5. Alt-Svc

When an HTTP/3 listener is configured, final responses on HTTP/1.1 and
HTTP/2 over TLS carry this field:

```
alt-svc: h3=":<port>"; ma=<altSvcMaxAge>
```

- **`ma` defaults to 86400 seconds.** That is RFC 7838's own default of 24
  hours, written out so that the value is visible. A deployment that moves
  its QUIC port lowers it, and `0` is allowed.
- **The port** is the QUIC socket's own (`netLocalPort(fd)`), unless
  `altSvcPort` is nonzero. That covers a NAT or a load balancer in front of
  the server.
- **The bytes are made once** in `listenHttp3`. No request builds them.
- **Which responses carry it:**
  - Only final responses (status 200 or more) carry it.
  - It is never sent on h3, since the client is already there.
  - It is never sent on h2c. An h2c response reaches clients through a
    proxy, and the field would advertise the backend's port as the origin's.
  - It is sent on cleartext HTTP/1.1. Browsers act on it only for `https`
    origins and ignore it otherwise, and a TLS-terminating proxy in front
    passes it on, which is the case it is there for.
- **The program wins.** If the program's own fields already hold
  `alt-svc`, the façade adds nothing.
- **A header field, not a frame.** HTTP/2 also has an ALTSVC frame (RFC
  7838 §4), but only `http2.ts` could write it. The header field is
  equivalent for clients, so G7 does not use the frame.

**Fields are appended without mutating the program's arrays.** Adding
`content-length` and `alt-svc` must not grow or mutate the `names` and
`values` arrays the program passed in. The façade keeps one names/values
pair of arrays for each length from 0 to `maxResponseFields`. Each pair is
made on its first use and then reused; the façade copies references, not
bytes, into the pair for the length it needs. A response with more than
`maxResponseFields` fields in total is refused with `HANDLER_DROPPED`, and
the façade checks this before it writes any byte.

## 6. A warmed request allocates nothing

`HttpHandler`'s invariant, "nothing is allocated per request once warm",
holds across all four versions. Every buffer is made at construction, at
listen time, or on first use and then kept:

| What | Made | Per warmed request |
| --- | --- | --- |
| request pool (`HttpServerRequest` × `requests`) | constructor | none |
| each request's `head`, `spans`, `params`, `body`, `pending` | grown to the largest seen, then kept | none |
| HTTP/1.1 connections | `Http1Server`, reused per slot | none |
| HTTP/2 connections and `Http2Pools` | first accept on a slot, then `restart` | none |
| HPACK decoding | `Http2Connection` | none ([#473](https://github.com/amritk/nish/issues/473)) |
| h2c preface arrays | `listenH2c` | none |
| HTTP/3 slots and `BufferPool`s | `listenHttp3`, slots reused | none |
| stream-to-request tables | listen time | none |
| response field arrays, one pair per length | first use of each length | none |
| Alt-Svc bytes | `listenHttp3` | none |
| content-length digits | per-request scratch | none |
| TLS random and ephemeral key buffers | listen time, filled in place | none |
| JSON writer | constructor | none |

The rules that keep it true:

- No `subarray`.
- No string building.
- No per-request array literal. The examples' constant bodies and content
  types are module-level arrays.

The tests pin this per version: `Arena.used()` is the same before and after
a warmed run. For HTTP/3 that pin is new. Today `net_http3_server` pins only
`receive`, and nothing pins a whole warmed h3 request.

## 7. What each version still refuses

| Version | Not offered by G7 |
| --- | --- |
| HTTP/1.1 | TLS (F2); `Upgrade` and WebSocket (stay on `Http1Server`, [WebSocket](guide/using-nish/websocket.md)); `Upgrade: h2c` (served as plain HTTP/1.1) |
| HTTP/2 over TLS | HTTP/1.1 fallback on the port (F2); server push; extended CONNECT; the ALTSVC frame; response trailers; RFC 9218 priorities |
| h2c | `Upgrade: h2c` and 101; HTTP/1.1 or sniffing on the port; any response to a bad preface; confidentiality of any kind |
| HTTP/3 | WebTransport, datagrams and extended CONNECT; any ALPN but `h3` |
| all | 1xx and 103 Early Hints; streaming request bodies (held whole up to `maxBody`, 413 above); async `serve` over the façade (follow-up, §2.5) |

### 7.1 Cross-version equivalence

The same route answers with the same status, the same fields (except for
`alt-svc`, and the `content-length` that HTTP/1.1 frames on its own) and
the same body on every version. The router is shared, and the head is
copied into one layout.

### 7.2 Nothing is parsed twice

Each carrier has already parsed and validated its head:

- `Http1Parser` checks request-line and field syntax.
- HPACK and QPACK decode into `HttpFields`, and the h2 and h3 layers
  refuse connection-specific fields.

The façade copies the bytes together with their spans and never splits a
field again. A byte sequence therefore means the same thing on every
version.

## 8. Test matrix

### 8.1 `tests/link/net_http2_cleartext` (g7-h2c)

| Case | Expect |
| --- | --- |
| a client built from raw frames (as `tests/link/net_http2` builds them) sends the preface, SETTINGS and a GET | 200 with the exact body; SETTINGS ACK |
| an HTTP/1.1 request line instead of the preface | closed at the first differing byte, 0 bytes written |
| an HTTP/1.1 request with `Upgrade: h2c` | closed, 0 bytes written |
| 10 bytes of preface, then hangup | slot freed; no `Http2Pools` buffer borrowed |
| 10 bytes of preface, then silence | closed by `prefaceTimeout` |
| `curl --http2-prior-knowledge` | 200, when `curl` has HTTP/2; otherwise a skip line naming why |
| `h2load -n 1000 -c 4` smoke run | 1000 succeeded, 0 failed, when `h2load` exists; otherwise a skip line |
| `Arena.used()` over a warmed run of 100 requests | flat |
| negative: `slots` of 0 | the constructor panics |

### 8.2 `tests/link/net_http_server` (g7-facade)

| Case | Expect |
| --- | --- |
| the same GET `/hello`, POST `/echo` and GET `/users/:id` over HTTP/1.1, h2c, h2 over TLS and HTTP/3 | identical status, body and fields on all four |
| Alt-Svc with an HTTP/3 listener | the exact bytes on HTTP/1.1 and h2 over TLS; absent on h2c and h3 |
| Alt-Svc without an HTTP/3 listener | absent everywhere |
| a program that sets its own `alt-svc` | the program's value, once |
| `Arena.used()` over a warmed run, per version | flat on all four |
| a deferred answer (taken in one turn, answered in the next) | delivered |
| the client resets the stream, or hangs up, before the answer | `hungUp` true, answer `HANDLER_DROPPED`, no bytes on a reused slot |
| request pool full | h2: RST_STREAM REFUSED_STREAM; h3: H3_REQUEST_REJECTED; h1: back-pressure, then served |
| body over `maxBody` | 413 on every version |
| response over `maxResponseFields` | `HANDLER_DROPPED`, nothing written |
| a window of 1 byte on h2 and h3 | the whole body arrives in order via `pending` |
| negative: `wait` with a TLS or QUIC listener | panics |
| negative: `webtransportSessions > 0`; `enableConnectProtocol`; a second listener of one kind | panics |

The h2 over TLS and h3 runs reuse the loopback client and certificate
fixtures in `tests/link/net_interop_server`. When `curl` with HTTP/3
exists, one GET goes over it as a smoke check; otherwise a skip line is
printed. The guide page, `docs/guide/using-nish/http-server.md` (with its
route in `scalar.config.json`), lands with g7-facade.

## 9. Security

Both modules read the network, so each lands with its record and index row
in the same PR (`node scripts/security-scope.mjs`).

### 9.1 `docs/security/http2-cleartext.md` (g7-h2c)

- **Scope:** `std/net/http2-cleartext.ts`. Everything after the preface is
  [http2.md](security/http2.md)'s scope and findings, unchanged.
- **No confidentiality, no integrity.** Anyone on the path reads and edits
  the traffic. The intended use is upstream of a TLS-terminating proxy, on
  loopback or a private network. The guide page says so before it shows the
  listen call.
- **Bad preface:** the connection is closed at the first differing byte,
  with no response. That gives a port scanner or a confused HTTP/1.1 client
  nothing back, and it is pinned by a test.
- **A slowloris on the preface** is bounded to 24 bytes and one slot per
  connection, for at most `prefaceTimeout`. No input buffer is borrowed.
- **Slot exhaustion:** `accept` refuses past `slots`, as `Http2TlsServer`
  does.

### 9.2 `docs/security/http-server.md` (g7-facade)

- **Scope:** `std/net/http-server.ts`.
- **Request smuggling across versions:** the façade carries spans and never
  re-parses (§7.2), so a downgrade-style smuggle has no second parser to
  disagree with.
- **`:authority` and `host`:** if both are present and differ, the request
  is answered 400 (RFC 9113 §8.3.1 and RFC 9114 §4.3.1 require them to
  agree). When they agree, only `:authority` is copied into the view, as its
  `host` field.
- **Cross-version starvation:** the request pool is shared, so one h2
  connection could hold up to `maxStreams` requests. A per-connection cap,
  `min(maxStreams, requests / 4)`, keeps one peer from taking the pool. The
  record pins it with a test.
- **Late answers:** slot generations and stream marks (§3.3). An answer
  never reaches a different connection or stream.
- **Alt-Svc comes only from configuration.** No request field changes it,
  so a client cannot steer other clients to a host.
- **Timeouts:** `bodyTimeout` and `idleTimeout` (§3.4) bound what a silent
  h2 or h2c peer can hold.

[handler.md](security/handler.md), [router.md](security/router.md),
[http3.md](security/http3.md), [quic.md](security/quic.md) and
[tls.md](security/tls.md) keep their scopes. The façade adds no parsing to
them.
