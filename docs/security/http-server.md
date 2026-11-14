# Security record: one HTTP server for HTTP/1.1, 2 and 3

The record of WP39's G7 stage: `nish/net/http-server`, one request pool and
one answer API over the HTTP/1.1 carrier, HTTP/2 over TLS, cleartext HTTP/2
(h2c) and HTTP/3
([http-one-handler.md](https://github.com/amritk/nish/blob/main/docs/http-one-handler.md)).
It says what the façade holds per connection and per request, what it
refuses and how, what happens to an answer that outlives its connection or
stream, and the test that pins each property. It is written with the code
rather than after an audit, so that the audit of the HTTP application layer
starts from evidence.

Anchors are function names in `std/net/http-server.ts` at `beda3eaa`, the
last commit to change it on the head that merges this record.

**Result.** The façade parses nothing itself. A request's bytes are read by
its carrier: the HTTP/1.1 head and body framing by `nish/net/http1-server`
(`docs/security/http1-codec.md`), an HTTP/2 or HTTP/3 field section by
HPACK or QPACK and `HttpFields.readRequest`, which checks the pseudo-fields
and that `host` names `:authority`. The façade lays what the carrier made
out in a request, never re-reads it as HTTP/1.1, and routes it with the
router (`docs/security/router.md`). So no request reaches a route
differently from how its own carrier framed it, and there is no
cross-version smuggling to try. What the façade adds is the bookkeeping the
handler adds (`docs/security/handler.md`), shared across four carriers:
one pool of `requests` requests, a cap per connection, generations so an
answer never reaches the wrong peer, a body deadline, and the Alt-Svc field.
Every piece is bounded by `HttpServerLimits`, and each listener refuses at
configuration a carrier whose own caps would let in more.

One finding was fixed in review: a stream reset while its answer was still
flushing kept its request out of the pool for good (HTTPSRV-12, Medium).
One is left open: the cap that keeps one connection from taking the pool is
per connection, not per peer, so a client with many connections can still
fill it (HTTPSRV-6, Low).
Two properties are the program's and are accepted: how long it holds a
request it took (HTTPSRV-8) and what it does with a decoded parameter
(HTTPSRV-9). So is the nature of h2c, which nothing protects on the wire
(HTTPSRV-11).

## Scope

| File | Functions |
| --- | --- |
| `std/net/http-server.ts` | `HttpServerLimits`; `HttpServerRequest` (`methodIs`, `pathIs`, `paramStart`, `paramEnd`, `paramIs`, `param`, `paramDecimal`, `checkParam`, `query`, `hasQuery`, `queryIndex`, `header`, `valueStart`, `valueEnd`, `headerIs`); `HttpServer` (`listenHttp1`, `listenH2c`, `listenHttp2Tls`, `listenHttp3`, `checkHttp2`, `watch`, `fired`, `wait`, `waitSigned`, `turnWith`, `drain`, `connections`, `ready`, `take`, `hungUp`, `start`, `write`, `end`, `send`, `sendFields`, `empty`, `json`, `sendJson`, `problem`, `refuse`, and the private `restListener`, `acceptHttp1`, `h1Serve`, `drive`, `starve`, `feedStarved`, `settle`, `roomy`, `begin`, `gather`, `whole`, `resume`, `pushH1`, `finishH1`, `releaseReading`, `h1Close`, `h1Forget`, `h1Sweep`, `h1Ready`, `h1Screen`, `declared`, `growBody`, `sweepCap`, `setAltSvc`, `h3Drained`, `h3Owned`, `obtain`, `admit`, `route`, `append`, `enqueue`, `release`, `drop`, `taken`, `keep`, `own`, `live`, `unlink`, `outFields`, `hasField`, `digits`, `abort`, `carry`, `nudge`, `push`, `writeProblem`, `writeProblemObject`, `allowFor`, `h1Of`, `h2Of`, `h3Of`, `screen`, `fromFields`, `put`, `putField`, `acceptHttp2`, `h2Serve`, `h2Event`, `h2Direct`, `h2Entry`, `h2Find`, `h2Settle`, `h2PushAll`, `moves`, `h2Close`, `h2Forget`, `h3Turn`, `h3Serve`, `h3Event`, `h3Direct`, `h3Entry`, `h3Find`, `h3Clear`, `expireAll`, `late`, `h2Expire`, `h3Expire`, `carryEnd`, `perOf`, `h2Grow`, `rest`, `unlisten`, `acceptH2c`, `h2Opened`, `h2Holds`, `h2Conn`, `h2Next`, `h2Flush`, `h2FdOf`, `h2cOf`); the helpers `httpServerLimit`, `httpServerAllowAppend`, `httpServerGrown`, `httpServerSpanIs`, `httpServerDecimal`, `httpServerFormByte`, `httpServerFormIs`, `httpServerFormDecode` |

Out of scope, each with its own record: the carriers
(`std/net/http1-server.ts`, `std/net/http2*.ts`, `std/net/http3*.ts`,
`std/net/http-fields.ts`), TLS, QUIC and its listener, the router, and
`nish/net/handler` and `nish/net/serve`, which this module sits beside and
does not change. What a program does with a request it has taken is the
program's.

## Threat model

The attacker is the client: every byte of every request on every version is
theirs. They may open as many connections as each listener accepts, on any
of the three versions at once, over TLS or cleartext, open as many streams on each as its carrier
allows, send a body slowly or not at all, reset a stream, and leave at any
moment, including while the program holds their request.

A win is a panic, memory or time a request can make the server spend beyond
the limits the program set, one peer receiving an answer meant for another,
a request routed differently from what its own carrier read, a connection on
one version starving those on another, or an Alt-Svc field a request chose.
The program and its `HttpServerLimits` are trusted. Misuse of the answer API
(a status outside 200 to 599, more or less body than the length said, a
second `start`, an answer through another server) panics, since a peer
cannot cause it.

## Findings

Rows HTTPSRV-1 to HTTPSRV-5, HTTPSRV-7 and HTTPSRV-10 are the shapes an
attacker's traffic can take, each checked and found to hold. HTTPSRV-6 is
open. HTTPSRV-8, HTTPSRV-9 and HTTPSRV-11 are accepted. HTTPSRV-12 was
fixed in review, with a test that failed before the fix.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| HTTPSRV-1 | High if it failed | `screen`, `fromFields`, `begin`, `route` | A request carried by HTTP/2 or HTTP/3 must not reach a route its own carrier would not, by being re-read as HTTP/1.1 (cross-version smuggling), nor by a `host` that names another authority. | **Holds.** `fromFields` copies the method, the path and each field the carrier decoded into the request's head as ranges; nothing is joined into HTTP/1.1 text and parsed again, so a field value holding CR, LF or a request line stays a value. `:authority` is given as `host` in place of any `host` field, and the carrier has already refused a `host` that names another authority (`HTTP_FIELDS_AUTHORITY_MISMATCH`, a `PROTOCOL_ERROR` reset on HTTP/2 and `H3_MESSAGE_ERROR` on HTTP/3), so the route sees one authority. `link/net_http_fields` pins the check: "a host that names :authority reads", "one that names another is refused". |
| HTTPSRV-2 | High if it failed | `listenHttp1`, `listenH2c`, `listenHttp2Tls`, `listenHttp3`, `screen`, `h2Event`, `h3Event`, `gather` | A head or a body must not grow a request past `maxHead`, `maxFields` or `maxBody` on any version. | **Holds.** Each listener refuses, at configuration, a carrier whose own caps admit more than the limits: the HTTP/1.1 target and head bytes against `maxHead` and its fields against `maxFields`; HTTP/2's `maxHeaderListSize` (over TLS or h2c, through `checkHttp2`) and HTTP/3's `maxFieldSectionSize` against `maxHead`. `config.maxBody` on HTTP/1.1 is set to `limits.maxBody`. On HTTP/2 and HTTP/3, `screen` answers 431 for a head past either cap and 413 for a declared length past `maxBody` before a request is taken from the pool, and `h2Event` and `h3Event` answer 413 and release the request once DATA would pass `maxBody`, whether a length was declared or not. On HTTP/1.1, `h1Screen` answers CONNECT 501 and `OPTIONS *` 204 before a request is taken. A body grows in tiers (`growBody`): up to `T = min(65536, maxBody)` it doubles from 64 bytes, never past `T`; past `T` it is replaced once by an array of exactly `maxBody`; a declared length is allocated at once, so a head alone that declares more than 64 KiB reserves a `maxBody` array for its pool entry before a body byte comes. So the bodies a server holds stay below `requests × (maxBody + 3T)`, the headers-only case included. Each request's `pending` buffer, the answer bytes its carrier had no room for yet, grows to `min(2^30, max(needed, 2 × current))`; a `write` whose remainder would pass 2^30 answers `HANDLER_DROPPED` and keeps nothing. A drain's datagram buffer is `HTTP_SERVER_UDP_SIZE`, 64 KiB. `link/net_http_server` pins the tiers with a `maxBody` of 1048575, not a power of two: "eight chunked bodies of maxBody 1048575 are held in arrays of exactly maxBody", "below 8 × (maxBody + 192 KiB)", which read the held arrays' own lengths, and "eight held bodies of 1000 bytes are each in an array of at most 64 KiB, not maxBody", which reads each array too: `Arena.used` counts only the newest chunk, and an array past 64 KiB takes a chunk of its own, so an arena total would not see a `maxBody` array. `link/net_http_server_lifecycle` pins the same on h2c, "and each holds its body in at most 64 KiB, not maxBody's 1 MiB", which failed with a `growBody` that always allocated `maxBody`; and the head caps: "16400 bytes of fields are answered 431", "a 9000-byte target is answered 414", "a chunked body past the cap is answered 413". `link/net_http_server_matrix` pins the h2c and HTTP/3 screen with a `maxBody` of 1000: "a declared body past maxBody 1000 is answered 413", "an undeclared one is answered 413 when it passes it", "100 fields past the pseudo-headers are answered 431", on each. |
| HTTPSRV-3 | High if it failed | `live`, `own`, `h1Close`, `h2Close`, `h3Clear`, `drop` | An answer for a request whose connection closed or whose stream was reset must not reach whoever holds the slot or stream now, and an answer through another server must not reach that server's peers. | **Holds.** Each slot of each carrier carries a generation, bumped when its connection closes, and a request remembers the one it was read under; a reset stream marks its request `hung`. `live` checks both, and an answer for a stale one answers `HANDLER_DROPPED`, sends nothing and hands the request back; a reset hands back a request in any state the program no longer holds (HTTPSRV-12). `hungUp` reads true for each of those, and on HTTP/1.1 and HTTP/2 also once the peer's byte stream ends, a half-close included, whose answer may still be delivered. `link/net_http_server_lifecycle` pins it under a pool of one, for an h2c RST_STREAM, an h2c socket closed, an HTTP/3 RESET_STREAM with STOP_SENDING and an HTTP/3 CONNECTION_CLOSE: "the held request reads hungUp", "and send answers HANDLER_DROPPED" (for the closed socket, "and send ends it, SENT or DROPPED", since whether the kernel still takes the write is timing), "then the next request is served on the returned entry" ("h2c socket closed: the held request reads hungUp" failed before `hungUp` read the HTTP/2 byte stream's end). `own` checks that a request belongs to this server's pool before any answer reads its slot, and panics if not, so a program with two servers cannot send one server's request out over the other's connection with a matching slot and generation. |
| HTTPSRV-4 | Medium if it failed | `listenHttp2Tls`, `listenHttp3`, `obtain`, `h2Entry`, `h3Entry` | One connection must not take every request in the pool, so that HTTP/1.1, HTTP/2 and HTTP/3 clients share it. | **Holds** per connection. An HTTP/2 or HTTP/3 connection holds at most `max(1, min(maxStreams, requests / 4))` requests (`maxStreamsBidi` on HTTP/3); a stream past that, or past a full pool, is refused with `REFUSED_STREAM` or `H3_REQUEST_REJECTED`, which a client may retry. An HTTP/1.1 connection holds one request, and with the pool full it stops being read until one is free (`starve`, `feedStarved`). See HTTPSRV-6 for many connections. `link/net_http_server_caps` pins it with clients that hold streams open on `/slow`: at `requests` 8, "requests 8, h2c: two streams held on one connection, the third refused", "four connections hold two each: the pool of eight is full" and "a fifth connection's stream is refused" on h2c, and "a fifth connection's stream is H3_REQUEST_REJECTED" on HTTP/3; at `requests` 1, 2 and 3, "a connection's second stream is refused" and "the next connection's stream is refused" (h2c) or "is H3_REQUEST_REJECTED" (HTTP/3). For HTTP/1.1, `link/net_http_server` pins the full pool at `requests` 1: "under requests 1 a held request takes the only pool entry", "a second connection's request waits unread while the pool is empty". |
| HTTPSRV-5 | Medium if it failed | `wait`, `expireAll`, `late`, `h2Expire`, `h3Expire`, `h1Sweep`, `listenH2c` | A slow or silent peer must not hold a request past a deadline on any version. | **Holds.** `bodyTimeout` runs from the turn a head was read (`since`); `expireAll` ends a request still reading past it: the HTTP/1.1 connection closes, the HTTP/2 or HTTP/3 stream is reset, and the request goes back to the pool. An HTTP/2 connection with no open stream closes after `idleTimeout`, which also bounds a handshake that never finishes; an h2c connection that has not sent its preface is closed by its carrier after `prefaceTimeout`, and `idleTimeout` runs from its preface. HTTP/1.1 and HTTP/3 keep their carriers' own idle timeouts (HTTP/3's is QUIC's `maxIdleTimeout`). `link/net_http_server_carriers` pins both h2c deadlines: "an h2c connection that never sends its preface is closed by prefaceTimeout", "one silent after its preface is closed by idleTimeout". `link/net_http_server_timeouts` pins `bodyTimeout` on h2c ("a body that never comes has its stream reset CANCEL") and HTTP/3 ("its stream is reset H3_REQUEST_CANCELLED and its sending stopped"), and `idleTimeout` over TLS ("a connection with no stream is closed"). As HANDLER-5 records, the deadline is checked only when `wait` returns. |
| HTTPSRV-6 | Low | `listenHttp2Tls`, `listenHttp3`, `acceptHttp1`, `acceptHttp2` | The per-connection cap (HTTPSRV-4) bounds a connection, not a peer: a client that opens four HTTP/2 or HTTP/3 connections, or `requests` HTTP/1.1 connections, and sends heads with no body can hold the whole pool until `bodyTimeout` ends them, and every other client's stream is refused meanwhile. | **Open.** A per-address bound needs the peer's address, which the façade does not see, and is a deployment's policy: a proxy, a firewall's connection limit, or the carriers' `slots`. The pool's fill is bounded in time by `bodyTimeout` (HTTPSRV-5), and a refused HTTP/2 or HTTP/3 stream is retryable. |
| HTTPSRV-7 | Low if it failed | `outFields`, `listenHttp3` | The Alt-Svc field must come only from configuration, never from a request, and must not be sent in cleartext HTTP/2, where an on-path attacker could not be told apart from the server that advertised it. | **Holds.** `listenHttp3` builds it once from the UDP socket's own port, or `altSvcPort`, and `altSvcMaxAge`; `outFields` adds that buffer to each HTTP/1.1 answer and each HTTP/2 over TLS answer whose own fields name no `alt-svc`, and to no h2c answer (`r.secure` false). No byte of a request reaches it. `link/net_http_server_carriers` pins "every stream ended, and no alt-svc on any" over h2c, and with `altSvcMaxAge` 0 "HTTP/2 over TLS says alt-svc: clear", "h2c says nothing of alt-svc". |
| HTTPSRV-8 | Low | `take` | A request the program has taken and not answered stays allocated after its connection closes. | **Accepted**, as HANDLER-7: how long the program holds a request is its policy. Answering, even with a dropped result, returns it, and the pool never grows past `requests`. |
| HTTPSRV-9 | Low | `param`, `query` | A decoded parameter or query value may hold `/`, `..`, NUL or any byte. | **Accepted**, as HANDLER-8 and ROUTE-8: refusing those is the caller's job, and the guide page says so. |
| HTTPSRV-10 | High if it failed | `h2Grow`, `h2Holds`, `h2Conn`, `h2Event`, `live` | HTTP/2 over TLS and h2c share one table of slots, generations and stream entries; an answer or a request must not cross from a connection of one into a slot of the other, and growing the table for the second listener must not move a request already taken. | **Holds.** Each listener owns a fixed range of virtual slots, given when it is configured (`h2TlsBase`, `h2cBase`), and every per-slot call goes to the carrier that owns the range (`h2Clear` says which), so a slot index means one connection of one carrier. `h2Grow` widens the per-slot stream table to the larger of the two listeners' caps and remaps the entry of each HTTP/2 request already in the pool, so `live`'s slot and generation check (HTTPSRV-3) still names the same connection. `r.secure` is set from the owning carrier, false on h2c. |
| HTTPSRV-11 | Medium | `listenH2c` | An h2c connection is neither encrypted nor authenticated: anyone on the path reads and rewrites every request and answer. | **Accepted.** That is what h2c is; the guide page says to serve it only behind a proxy that ends TLS, or on a trusted network. The façade adds nothing on top that would claim otherwise: `r.secure` is false and no Alt-Svc is sent (HTTPSRV-7). |
| HTTPSRV-12 | Medium | `h2Close`, `h3Clear`, `release`, `drop` | A stream reset while its answer was still flushing left its request outside the pool for good, so a client that reset enough streams emptied the pool and every later stream was refused. | **Fixed.** A reset now hands back a request in any state the program no longer holds (commit `2fa11bf`). `link/net_http_server_carriers` pins it with a pool of one: "the reset handed the request back: the next stream is answered, not refused", which failed before the fix. |

## Properties verified

HTTP/1.1 is pinned by `tests/link/net_http_server/expected.out`, which
`link/net_http_server: exits with 0 and stdout matches expected.out`
compares byte for byte, over loopback sockets: the body cap (HTTPSRV-2):
"a declared body one byte over the cap is answered 413", "and the connection
ends", "a body exactly at the cap is taken whole and echoed byte for byte";
late answers (HTTPSRV-3): "its peer leaves, and the idle timeout ends the
connection before the answer", "the late answer is dropped", "an answer for
the old connection is dropped though the slot is in use again", "and the new
connection never sees it", "the dropped requests went back to the pool"; the
body deadline (HTTPSRV-5): "a body trickled inside the idle timeout is cut
off at the body deadline", "with no answer", "and its slot is freed"; and the
drain: "a draining connection's answer says it closes", "and the pipelined
request is not read: the connection closes".

HTTP/2 over TLS and HTTP/3 are pinned by
`link/net_http_server_carriers: exits with 0 and stdout matches expected.out`,
which drives both listeners of one server with scripted clients: "HTTP/2: a
TLS handshake offering h2, the server's signature and Finished verified", "a
GET of /hello: 200 and its body", "with alt-svc naming the HTTP/3 port, and
its content-length" (HTTPSRV-7), "a POST of /echo: its body echoed", "a GET
of a path no route has: 404 as problem+json", and on HTTP/3 "the handshake
through the listener into a slot, ALPN h3", "200 with its body echoed",
"404 as problem+json". The same server's h2c listener answers the same
requests alike: "h2c: a connection to the cleartext listener", "a GET of
/hello: 200, its body, its content-length and no alt-svc"; and a server with
the h2c listener alone turns by `wait`: "wait serves it: /hello answered and
every stream ended".

The configuration checks (HTTPSRV-2) and the answer API's panics are each
pinned by a link test that exits 1 with its message, among them
`link/net_http_server_h1_head`, `net_http_server_h1_fields`,
`net_http_server_h2_head`, `net_http_server_h3_head`,
`net_http_server_h2_connect`, `net_http_server_h3_webtransport`,
`net_http_server_wait_tls`, `net_http_server_h2c` (a second h2c listener) and, for `own` (HTTPSRV-3),
`link/net_http_server_foreign: exits with 1 and stdout matches expected.out`.

HTTPSRV-4's per-connection cap and HTTPSRV-5's `bodyTimeout` on HTTP/2 and
HTTP/3 are pinned by `link/net_http_server_caps` and
`link/net_http_server_timeouts`, whose scripted clients hold streams open on
a route the program does not answer until told.

`link/net_http_server_lifecycle` pins the rest of a request's life on h2c
and HTTP/3: the hang-ups of HTTPSRV-3; the arena under held bodies
(HTTPSRV-2), "eight requests with 1000-byte bodies are held", "and each
holds its body in at most 64 KiB, not maxBody's 1 MiB", read on each held
request's array, then, counting only what the server's own `wait` and `send`
calls leave allocated, "and the server keeps no more of the arena for them"
over eight more rounds; the drain, "a new HTTP/3 connection's Initial gets no answer",
"drain, h2c: and the connection carries a GOAWAY", "drain, h3: and the
server's control stream carries a GOAWAY", each held request answered; and
`maxFields` with and without `:authority`, "no :authority and 100 other
fields is served", ":authority and 99 others is served", ":authority and 100
others is 431", on each, and on h2c ":authority, host and 99 others is
served", the `host` field giving way to `:authority` (it was 431 before
`screen` counted the fields `fromFields` lays out).

A pipeline of HTTP/1.1 requests behind a held one must not grow the stack
per request. `tests/run.js` runs `tests/link/net_http_server/deep.ts` under
a 512 KiB stack: "net_http_server_deep: twenty-five thousand pipelined
OPTIONS * behind a held request are answered on a 512 KiB stack".

## Notes

These hold and are recorded so an audit need not rediscover them.

- A request's head, spans and parameter ranges are allocated on its first
  use and reused after, so a pool's memory is bounded by its high-water mark.
- An answer past `maxResponseFields` is dropped (`HANDLER_DROPPED`): no head
  is written, and the stream is reset (HTTP/2 `INTERNAL_ERROR`, HTTP/3
  `H3_INTERNAL_ERROR`, 0x102) or the HTTP/1.1 connection closed.
  `link/net_http_server_matrix` pins it on h2c and HTTP/3: "nothing of it is
  written, and the stream is reset".
- A HEAD answer on HTTP/2 and HTTP/3 carries no `content-length`.
- `pushH1` ignores a write error other than `EAGAIN`: the bytes stay
  pending, and the connection's next read sees the peer gone and closes it.
- The return values of the carriers' `reset` calls are not checked: a reset
  of a stream already gone does nothing, which is the outcome wanted.
- `problem` passes -1 as the body length to `send` when not even an empty
  problem object fits the `jsonBytes` scratch buffer. Its size is
  configuration, which is trusted, and every default fits one.
- The slot counts a listener is given, and their products with the
  per-connection caps, are not bounded by the façade; they are
  configuration, which is trusted.
- The body-deadline rows of `link/net_http_server` depend on timing: they
  trickle within the idle timeout and wait past `bodyTimeout`.
- During a drain the HTTP/3 listener takes no new connection: `h3Drained`
  drops an Initial for an unknown connection, and `h3Owned` checks a
  datagram's DCID against the connections still open.
