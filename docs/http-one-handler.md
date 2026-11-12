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

- `Http1Server`: `accept`, `holds`, `fd`, `readable`, `writable`, `next`,
  `connection`, `flush`, `rearm`, `expire` and `close`, with
  `Http1Connection`'s `respond`, `write` and `end`.
- `Http2Connection`: `feed`, `inputTail`, `received`, `endInput`, `next`,
  `respond`, `writeData`, `reset`, `consume`, `restart` and `rest`, plus
  `Http2Pools`.
- `Http2TlsServer`: `accept`, `holds`, `fd`, `readable`, `writable`,
  `signP256`, `next`, `connection`, `flush` and `close`.

`inputTail`, `received` and `endInput` are `@internal` in `http2.ts`
("read by `http2-tls.ts`'s server loop; not for callers"). The h2c carrier
is the second server loop in `std/net` and relies on them exactly as
`http2-tls.ts` does; its own doc comment says so. Like `Http2TlsServer`, it
sets each slot's `Http2Connection.pools` (one shared `Http2Pools`) and
`Http2Connection.date` (from one `HttpDate`), and offers the same slot
surface to the façade: `holds`, `fd`, `readable`, `writable`, `next`,
`connection`, `flush` and `close`.
- `Http3Server`: `serve`, `receive`, `ready`, `connection`, `flush`,
  `timeout`, `tick` and `stop`, with `Http3Connection`'s `respond`,
  `writeData`, `reset` and `discardRequest`.

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
import { Http1Config } from "nish/net/http1-server";
import { Http2Config } from "nish/net/http2";
import { Http3Config } from "nish/net/http3";
import { TlsServerConfig } from "nish/net/tls";
import { QuicServerConfig } from "nish/net/quic";

// Declared elsewhere in the program: the four sockets (tcpFd1..3, udpFd),
// tlsConfig: TlsServerConfig and quicConfig: QuicServerConfig (built as
// tests/link/net_interop_server builds them), entropy: u8[] of
// QUIC_LISTENER_ENTROPY_SIZE random bytes, key: Secret<u8[]>, and
// lookup(w: JsonWriter, id: i64): void.
const TEXT_PLAIN: u8[] = [/* "text/plain" */];
const HELLO_BODY: u8[] = [/* "hello" */];

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

for (;;) {
  server.waitSigned(1000, key);           // wait(ms) when every listener is cleartext
  while (server.ready()) {
    const r: HttpServerRequest = server.take();
    if (r.route === HELLO) {
      server.send(r, 200, TEXT_PLAIN, HELLO_BODY, 0, HELLO_BODY.length);
    } else if (r.route === ECHO) {
      server.send(r, 200, TEXT_PLAIN, r.body, 0, r.bodyLength);
    } else if (r.route === USER) {
      lookup(server.json(), r.paramDecimal(0)); // fills the shared writer
      server.sendJson(r, 200);
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
  maxHead: i32 = 16384;          // copied head (method, target, fields); 431 above
  maxFields: i32 = 100;          // fields in one request head; 431 above
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

The constructor checks every limit and panics, with the limit's name, on
one out of range, as `HandlerLimits` does: `requests` from 1 to 65536,
`maxBody` from 0 to 2^30, `maxHead` from 256 to 2^20, `maxFields` from 1 to
1024, `maxResponseFields` from 2 to 256, the three timeouts at least 1,
`altSvcMaxAge` from 0 to 2^31 − 1, `altSvcPort` from 0 to 65535,
`maxEvents` at least 1 and `jsonBytes` at least 256. Those ceilings keep
every product in §6 inside an `i64` and every per-entry size inside an
`i32`. The HTTP/1.1 carrier is configured from the same values
(`Http1Config.maxBody`, `maxHeaderBytes` and `maxHeaders`), so it refuses
what the façade would.

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
  fired(id: i32): boolean;                           // did the program's own fd `id` fire
  ready(): boolean;
  take(): HttpServerRequest;
  hungUp(r: HttpServerRequest): boolean;
  drain(): void;                                     // graceful stop, as HttpHandler.drain
  connections(): i32;                                // falls to 0 once drained
```

These are `HttpHandler`'s loop methods with the same signatures; only
`waitSigned` is new.

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

The answer methods have the same names, the same parameters and the same
return codes as `HttpHandler`, with `HttpServerRequest` in place of
`HttpRequest`. The codes are imported from `handler.ts`, not redefined:

```ts
  start(r, status: i32, names: u8[][], values: u8[][], bodyLength: i32): i32;
  write(r, buf: u8[], off: i32, len: i32): i32;
  end(r): i32;
  send(r, status: i32, contentType: u8[], body: u8[], off: i32, len: i32): i32;
  sendFields(r, status, names, values, body, off, len): i32;
  empty(r, status: i32): i32;
  json(): JsonWriter;                     // the shared writer, reset
  sendJson(r, status: i32): i32;          // sends what json() was filled with
  problem(r, status: i32, title: string, detail: string): i32;
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
names, and §2.3 and §2.4 match `HttpHandler`'s signatures, so a route body
moves between the two by changing one type name.
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
  regular field except `host`. A request with no `:authority` keeps its
  `host` field as sent. A request whose `:authority` and `host` differ never
  reaches the façade (§9.2).
- **HTTP/3.** At `H3_REQUEST`, the request takes the same `HttpFields`
  layout. It is valid only until the next request or trailers on the
  connection, so it is copied the same way.

**A head too large to copy.** The copy never grows `head` or `spans`. On
HTTP/2 and HTTP/3, a head whose copy would pass `maxHead` bytes or
`maxFields` fields is answered 431 with no body, and the stream ends; it
never reaches `take`. On HTTP/1.1 the carrier refuses it first, through
`maxHeaderBytes` and `maxHeaders` (§2.1). The h2 carrier's own
`maxHeaderListSize` refusal is also 431, so a client sees one status for
one fault on every version.

**Targets the router cannot match.** Routes start with `/`, so the router
matches neither the authority form of a plain `CONNECT` (which passes
`readRequest` on h2 and h3 with no `:path`) nor the `*` of `OPTIONS *`
([router.ts](../std/net/router.ts) leaves both to the program). The façade
answers both itself, the same way on every version, and never hands them to
`take`:

- **A plain `CONNECT`** is answered 501 with no body: the façade is an
  origin server and has no tunnel to offer (RFC 9110 §9.3.6, §15.6.2). On
  h2 and h3 the stream then ends; on HTTP/1.1 the connection is closed, as
  a tunnel request's bytes after the head are not HTTP.
- **`OPTIONS *`** is answered 204 with no body and no `Allow` field: a
  request about the server as a whole, which has no single method set
  (RFC 9110 §9.3.7).

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
body is not read. Each version already has the call for it:

- **HTTP/1.1.** The carrier's own `Http1Config.maxBody` is set to the
  façade's limit, as `HandlerLimits` does, so `Http1Server` answers 413
  itself and ends the connection. The façade never sees the request.
- **HTTP/2 and h2c.** After the 413 is written,
  `Http2Connection.reset(id, H2_NO_ERROR)` stops the body (RFC 9113 §8.1
  allows NO_ERROR after a complete response). On `H2_AGAIN` the reset is
  tried again on the connection's next turn; until it fits, further
  `H2_DATA` on the stream is consumed and dropped.
- **HTTP/3.** After the 413, `Http3Connection.discardRequest(id,
  H3_NO_ERROR)` sends STOP_SENDING and drops what the client still sends,
  unseen, whether or not the response is finished. That is RFC 9114 §4.1's
  "respond, then abort reading". `H3_CLOSED` (the stream is already gone)
  needs nothing more.

No carrier is changed for any of the three. Request trailers
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
  `perConnection = max(1, min(maxStreams, requests / 4))` requests (§9.2),
  computed once at listen time; `/` is integer division, so without the
  floor of 1 a pool of 1 to 3 requests would refuse every h2 and h3
  stream. With such a small pool one connection can hold all of it; that
  is the deployment's choice. If a stream opens past that cap, or the
  request pool is empty:
  - HTTP/1.1 back-pressures: the carrier does not read the next request.
  - HTTP/2 resets the stream with REFUSED_STREAM (RFC 9113 §8.7), which
    tells the client that the request was not processed and may be retried.
  - HTTP/3 resets the stream with H3_REQUEST_REJECTED (RFC 9114 §8.1),
    which means the same thing.

### 3.4 Timeouts (finding F4)

`Http1Server` has two clocks, `headTimeout` and `idleTimeout`, run by its
`expire(now)`; it has no body deadline. `HttpHandler` adds that one itself
(`expireBodies`). `Http2Connection` has no clock at all, and neither does
the `http2-tls.ts` carrier. The façade calls `Http1Server.expire` and runs
two deadlines of its own, using its own clock and each carrier's
`close(slot)`:

- **`bodyTimeout`:** the time from a request's head to its last body byte,
  for every version, as `HttpHandler.expireBodies` does for HTTP/1.1. On
  HTTP/1.1 it closes the slot; on h2 it resets the stream with CANCEL; on
  h3 it calls `discardRequest` and resets the stream.
- **`idleTimeout`:** how long an h2 or h2c connection may be open with no
  open stream.

`Http3Server` keeps QUIC's own idle timeout. Doing the timing in the façade
avoids a change to `http2.ts`. Neither deadline is enforced when a program
drives `Http2TlsServer` directly, as it is not today.

## 4. h2c: prior knowledge only

`std/net/http2-cleartext.ts` exports `Http2CleartextServer`. It has
`Http2TlsServer`'s method names (`accept`, `next`, `connection`, `flush`,
`close`, `fd`), with a TCP socket in place of the TLS server, plus
`expire(now)` for the preface deadline.

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
  its QUIC port lowers it.
- **`altSvcMaxAge = 0` sends `alt-svc: clear`.** RFC 7838 §3 defines
  `clear` as "invalidate every alternative cached for this origin", which
  is what an operator turning HTTP/3 off needs: sending nothing would leave
  an h3 alternative a client cached live for up to the old `ma` (24 h at
  the default). It is sent on HTTP/1.1 and h2 over TLS whether or not an
  HTTP/3 listener is configured, so a server that drops its QUIC socket
  keeps `altSvcMaxAge = 0` for at least the old `ma` and then may stop.
  `ma=0` is not used for this, because it makes only the advertised
  alternative stale, and a client may hold an earlier one.
- **The port** is the QUIC socket's own (`netLocalPort(fd)`), unless
  `altSvcPort` is nonzero. That covers a NAT or a load balancer in front of
  the server.
- **The bytes are made once**: the `clear` value at the constructor, the
  `h3` value in `listenHttp3`. No request builds them.
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
| each request's `head` (`maxHead` bytes), `spans` (4 × `maxFields`), `params` (the router's `maxParams`) | constructor, at their caps; never grown | none |
| each request's `body` | grown in two tiers, below | none once at its tier |
| each request's `pending` | grown to the largest remainder held, below | none once at that size |
| HTTP/1.1 connections | `Http1Server`, reused per slot | none |
| HTTP/2 connections and `Http2Pools` | first accept on a slot, then `restart` | none |
| HPACK decoding | `Http2Connection` | none ([#473](https://github.com/amritk/nish/issues/473)) |
| h2c preface arrays | `listenH2c` | none |
| HTTP/3 slots and `BufferPool`s | `listenHttp3`, slots reused | none |
| stream-to-request tables | listen time | none |
| response field arrays, one pair per length | first use of each length | none |
| Alt-Svc bytes | `clear` at the constructor, `h3` in `listenHttp3` | none |
| content-length digits, 20 bytes | constructor, per request | none |
| TLS server random and ephemeral key, 32 bytes each | `listenHttp2Tls`, refilled with `crypto.getRandomValues` before each `accept` | none |
| JSON writer, `jsonBytes` | constructor | none |

**What the arena can hold.** Memory is a bump arena: `Arena` has no
`release` and no `reset` (`runtime/nish.d.ts`). A grown array is a new
array, and the one it replaces stays in the arena for good. So a bound
counts every array an entry ever made, not only its last. Fixed-size arrays
(the rows above made at their caps) count once. Two arrays grow:

**`body`, in two tiers.** Let `T = min(65536, maxBody)`.

1. *Small tier.* A body that fits in `T` grows the entry's array to
   `min(T, max(needed, 2 × current))`, starting from 64 bytes; a declared
   length (`content-length`) is used as `needed` at once, so it takes one
   step, not many. Every step at least doubles except the one capped at
   `T`, so the arrays before the last sum to less than twice the last
   one before the cap, under `2 × T`, and with the capped one the tier
   holds less than `3 × T`.
2. *Large tier.* The first time an entry needs more than `T`, its body is
   replaced once by an array of exactly `maxBody`, and it never grows
   again. No rounding past `maxBody`.

One entry therefore holds less than `maxBody + 3 × T` in body arrays, live
and abandoned together. Over the pool, body memory is below
`requests × (maxBody + 3 × T)`: at the defaults
1024 × (1 MiB + 192 KiB) = 1.1875 GiB, reached only when every entry has
held a body over 64 KiB. An entry that never holds more than 64 KiB stays
under 192 KiB. Small bodies, the common case, never pay `maxBody`.
`maxBody ≤ 2^30` and `requests ≤ 65536` keep the product in an `i64`; it is
computed as one for the guide page, which states it beside both limits.

**`pending`, owned by the program.** It holds the part of a response that
flow control held back (§3.2), so its size is set by what the program
writes, not by the client. It grows the same way, to
`max(needed, 2 × current)`, so an entry holds less than 4 × the largest
remainder it has held, abandoned arrays included. The façade puts no cap
on it: a program that writes a 100 MiB body in one `write` to a client
that opens no window can make `pending` hold it. A program that serves
large responses writes them in pieces and waits for `hungUp` or the next
turn; the guide page says so.

**The warmed pin is exact about it:** `Arena.used()` is flat over a run
whose bodies and remainders are no larger than ones the same entries have
already held. A tighter bound, such as a few `maxBody` buffers shared by
the pool with a 503 or REFUSED_STREAM when all are taken, is possible
later without an API change; G7 does not need it.

**TLS bytes.** `Http2TlsServer.accept(serverRandom, ephemeralPrivate)` needs
32 fresh random bytes for each argument on every accept, and wipes
`ephemeralPrivate` once copied. The façade fills its two listen-time buffers
with `crypto.getRandomValues` just before each `accept`, as
`tests/link/net_interop_server/h2.ts` does; no bytes are reused across
handshakes.

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
| Alt-Svc without an HTTP/3 listener, `altSvcMaxAge` > 0 | absent everywhere |
| a program that sets its own `alt-svc` | the program's value, once |
| `Arena.used()` over a warmed run, per version | flat on all four |
| a deferred answer (taken in one turn, answered in the next) | delivered |
| the client resets the stream, or hangs up, before the answer | `hungUp` true, answer `HANDLER_DROPPED`, no bytes on a reused slot |
| request pool full | h2: RST_STREAM REFUSED_STREAM; h3: H3_REQUEST_REJECTED; h1: back-pressure, then served |
| body over `maxBody` | 413 on every version; h1: connection ended by the carrier; h2: RST_STREAM NO_ERROR after the 413; h3: STOP_SENDING H3_NO_ERROR after the 413, the rest dropped |
| one h2 connection opens more than `max(1, min(maxStreams, requests / 4))` streams | the excess get RST_STREAM REFUSED_STREAM; other connections still served |
| `requests` of 1, 2 and 3, one GET on each of h2 and h3 | served (the per-connection cap is 1, not 0) |
| `requests` of 0 | the constructor panics, naming `requests` |
| a body that stalls past `bodyTimeout` | h1: slot closed; h2: RST_STREAM CANCEL; h3: STOP_SENDING and reset; the request never reaches `take` |
| an h2 connection with no open stream past `idleTimeout` | closed; a connection with an open stream is not |
| an h2c connection that sends the preface, then nothing | closed by `idleTimeout`, not `prefaceTimeout` |
| `altSvcMaxAge = 0`, with and without an HTTP/3 listener | `alt-svc: clear` on HTTP/1.1 and h2 over TLS; absent on h2c and h3 |
| `altSvcPort` set | that port in the field, not the QUIC socket's own |
| with `requests` 8: a 1 MiB body on every pool entry, then 1 MiB bodies again | `Arena.used()` grows by less than 8 × (1 MiB + 192 KiB) in the first pass and is flat in the second (§6) |
| with `requests` 8: 1 KiB bodies on every entry | `Arena.used()` grows by less than 8 × 192 KiB; no entry makes a `maxBody` array |
| a head over `maxHead`, or more than `maxFields` fields, on each version | 431; nothing grows |
| a plain `CONNECT`, and `OPTIONS *`, on each version | 501, and 204 with no `Allow`; neither reaches `take` |
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
- **`:authority` and `host`:** the façade does no check of its own. Both
  carriers read the head through `HttpFields.readRequest`, which returns
  `HTTP_FIELDS_AUTHORITY_MISMATCH` when the two differ, and turn that into
  a stream error (PROTOCOL_ERROR on h2, H3_MESSAGE_ERROR on h3) before any
  request event. RFC 9113 §8.3.1 and RFC 9114 §4.3.1 require them to
  agree. When they agree, only `:authority` is copied into the view, as its
  `host` field. The record cites the carriers' tests rather than adding a
  façade path that cannot be reached.
- **Cross-version starvation:** the request pool is shared, so one h2
  connection could hold up to `maxStreams` requests. A per-connection cap,
  `max(1, min(maxStreams, requests / 4))` (§3.3), keeps one peer from
  taking the pool once it holds 4 or more requests. The
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
