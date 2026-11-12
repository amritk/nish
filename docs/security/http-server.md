# Security record: one HTTP server for HTTP/1.1, 2 and 3

The record of WP39's G7 stage: `nish/net/http-server`, one request pool and
one answer API over the HTTP/1.1 carrier, HTTP/2 over TLS and HTTP/3
([http-one-handler.md](https://github.com/amritk/nish/blob/main/docs/http-one-handler.md)).
It says what the façade holds per connection and per request, what it
refuses and how, what happens to an answer that outlives its connection or
stream, and the test that pins each property. It is written with the code
rather than after an audit, so that the audit of the HTTP application layer
starts from evidence.

Anchors are function names in `std/net/http-server.ts` at `cb9168f8`, the
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
handler adds (`docs/security/handler.md`), shared across three carriers:
one pool of `requests` requests, a cap per connection, generations so an
answer never reaches the wrong peer, a body deadline, and the Alt-Svc field.
Every piece is bounded by `HttpServerLimits`, and each listener refuses at
configuration a carrier whose own caps would let in more.

None of its findings was fixed in review, and one is left open: the cap that
keeps one connection from taking the pool is per connection, not per peer,
so a client with many connections can still fill it (HTTPSRV-6, Low).
Two properties are the program's and are accepted: how long it holds a
request it took (HTTPSRV-8) and what it does with a decoded parameter
(HTTPSRV-9).

## Scope

| File | Functions |
| --- | --- |
| `std/net/http-server.ts` | `HttpServerLimits`; `HttpServerRequest` (`methodIs`, `pathIs`, `paramStart`, `paramEnd`, `paramIs`, `param`, `paramDecimal`, `checkParam`, `query`, `hasQuery`, `queryIndex`, `header`, `valueStart`, `valueEnd`, `headerIs`); `HttpServer` (`listenHttp1`, `listenH2c`, `listenHttp2Tls`, `listenHttp3`, `checkHttp2`, `watch`, `fired`, `wait`, `waitSigned`, `turnWith`, `drain`, `connections`, `ready`, `take`, `hungUp`, `start`, `write`, `end`, `send`, `sendFields`, `empty`, `json`, `sendJson`, `problem`, `refuse`, and the private `restListener`, `acceptHttp1`, `h1Serve`, `drive`, `starve`, `feedStarved`, `settle`, `roomy`, `begin`, `gather`, `whole`, `resume`, `pushH1`, `finishH1`, `releaseReading`, `h1Close`, `h1Forget`, `h1Sweep`, `obtain`, `admit`, `route`, `append`, `enqueue`, `release`, `drop`, `taken`, `keep`, `own`, `live`, `unlink`, `outFields`, `hasField`, `digits`, `abort`, `carry`, `nudge`, `push`, `writeProblem`, `writeProblemObject`, `allowFor`, `h1Of`, `h2Of`, `h3Of`, `screen`, `fromFields`, `put`, `putField`, `acceptHttp2`, `h2Serve`, `h2Event`, `h2Direct`, `h2Entry`, `h2Find`, `h2Settle`, `h2PushAll`, `moves`, `h2Close`, `h2Forget`, `h3Turn`, `h3Serve`, `h3Event`, `h3Direct`, `h3Entry`, `h3Find`, `h3Clear`, `expireAll`, `late`, `h2Expire`, `h3Expire`); the helpers `httpServerLimit`, `httpServerAllowAppend`, `httpServerGrown`, `httpServerSpanIs`, `httpServerDecimal`, `httpServerFormByte`, `httpServerFormIs`, `httpServerFormDecode` |

Out of scope, each with its own record: the carriers
(`std/net/http1-server.ts`, `std/net/http2*.ts`, `std/net/http3*.ts`,
`std/net/http-fields.ts`), TLS, QUIC and its listener, the router, and
`nish/net/handler` and `nish/net/serve`, which this module sits beside and
does not change. What a program does with a request it has taken is the
program's.

## Threat model

The attacker is the client: every byte of every request on every version is
theirs. They may open as many connections as each listener accepts, on any
of the three versions at once, open as many streams on each as its carrier
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

Rows HTTPSRV-1 to HTTPSRV-5 and HTTPSRV-7 are the shapes an attacker's
traffic can take, each checked and found to hold. HTTPSRV-6 is open.
HTTPSRV-8 and HTTPSRV-9 are accepted. None was fixed in review, so the
index counts none as fixed.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| HTTPSRV-1 | High if it failed | `screen`, `fromFields`, `begin`, `route` | A request carried by HTTP/2 or HTTP/3 must not reach a route its own carrier would not, by being re-read as HTTP/1.1 (cross-version smuggling), nor by a `host` that names another authority. | **Holds.** `fromFields` copies the method, the path and each field the carrier decoded into the request's head as ranges; nothing is joined into HTTP/1.1 text and parsed again, so a field value holding CR, LF or a request line stays a value. `:authority` is given as `host` in place of any `host` field, and the carrier has already refused a `host` that names another authority (`HTTP_FIELDS_AUTHORITY_MISMATCH`, a `PROTOCOL_ERROR` reset on HTTP/2 and `H3_MESSAGE_ERROR` on HTTP/3), so the route sees one authority. `link/net_http_fields` pins the check: "a host that names :authority reads", "one that names another is refused". |
| HTTPSRV-2 | High if it failed | `listenHttp1`, `listenHttp2Tls`, `listenHttp3`, `screen`, `h2Event`, `h3Event`, `gather` | A head or a body must not grow a request past `maxHead`, `maxFields` or `maxBody` on any version. | **Holds.** Each listener refuses, at configuration, a carrier whose own caps admit more than the limits: the HTTP/1.1 target and head bytes against `maxHead` and its fields against `maxFields`; HTTP/2's `maxHeaderListSize` and HTTP/3's `maxFieldSectionSize` against `maxHead`. `config.maxBody` on HTTP/1.1 is set to `limits.maxBody`. On HTTP/2 and HTTP/3, `screen` answers 431 for a head past either cap and 413 for a declared length past `maxBody` before a request is taken from the pool, and `h2Event` and `h3Event` answer 413 and release the request once DATA would pass `maxBody`, whether a length was declared or not. A server holds at most `requests` times `maxHead + maxBody`. |
| HTTPSRV-3 | High if it failed | `live`, `own`, `h1Close`, `h2Close`, `h3Clear`, `drop` | An answer for a request whose connection closed or whose stream was reset must not reach whoever holds the slot or stream now, and an answer through another server must not reach that server's peers. | **Holds.** Each slot of each carrier carries a generation, bumped when its connection closes, and a request remembers the one it was read under; a reset stream marks its request `hung`. `live` checks both, and an answer for a stale one answers `HANDLER_DROPPED`, sends nothing and hands the request back. `own` checks that a request belongs to this server's pool before any answer reads its slot, and panics if not, so a program with two servers cannot send one server's request out over the other's connection with a matching slot and generation. |
| HTTPSRV-4 | Medium if it failed | `listenHttp2Tls`, `listenHttp3`, `obtain`, `h2Entry`, `h3Entry` | One connection must not take every request in the pool, so that HTTP/1.1, HTTP/2 and HTTP/3 clients share it. | **Holds** per connection. An HTTP/2 or HTTP/3 connection holds at most `max(1, min(maxStreams, requests / 4))` requests (`maxStreamsBidi` on HTTP/3); a stream past that, or past a full pool, is refused with `REFUSED_STREAM` or `H3_REQUEST_REJECTED`, which a client may retry. An HTTP/1.1 connection holds one request, and with the pool full it stops being read until one is free (`starve`, `feedStarved`). See HTTPSRV-6 for many connections. |
| HTTPSRV-5 | Medium if it failed | `wait`, `expireAll`, `late`, `h2Expire`, `h3Expire`, `h1Sweep` | A slow or silent peer must not hold a request past a deadline on any version. | **Holds.** `bodyTimeout` runs from the turn a head was read (`since`); `expireAll` ends a request still reading past it: the HTTP/1.1 connection closes, the HTTP/2 or HTTP/3 stream is reset, and the request goes back to the pool. An HTTP/2 connection with no open stream closes after `idleTimeout`, which also bounds a handshake that never finishes; HTTP/1.1 and HTTP/3 keep their carriers' own timeouts. As HANDLER-5 records, the deadline is checked only when `wait` returns. |
| HTTPSRV-6 | Low | `listenHttp2Tls`, `listenHttp3`, `acceptHttp1`, `acceptHttp2` | The per-connection cap (HTTPSRV-4) bounds a connection, not a peer: a client that opens four HTTP/2 or HTTP/3 connections, or `requests` HTTP/1.1 connections, and sends heads with no body can hold the whole pool until `bodyTimeout` ends them, and every other client's stream is refused meanwhile. | **Open.** A per-address bound needs the peer's address, which the façade does not see, and is a deployment's policy: a proxy, a firewall's connection limit, or the carriers' `slots`. The pool's fill is bounded in time by `bodyTimeout` (HTTPSRV-5), and a refused HTTP/2 or HTTP/3 stream is retryable. |
| HTTPSRV-7 | Low if it failed | `outFields`, `listenHttp3` | The Alt-Svc field must come only from configuration, never from a request. | **Holds.** `listenHttp3` builds it once from the UDP socket's own port, or `altSvcPort`, and `altSvcMaxAge`; `outFields` adds that buffer to each HTTP/1.1 and HTTP/2 answer whose own fields name no `alt-svc`. No byte of a request reaches it. |
| HTTPSRV-8 | Low | `take` | A request the program has taken and not answered stays allocated after its connection closes. | **Accepted**, as HANDLER-7: how long the program holds a request is its policy. Answering, even with a dropped result, returns it, and the pool never grows past `requests`. |
| HTTPSRV-9 | Low | `param`, `query` | A decoded parameter or query value may hold `/`, `..`, NUL or any byte. | **Accepted**, as HANDLER-8 and ROUTE-8: refusing those is the caller's job, and the guide page says so. |

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
"404 as problem+json".

The configuration checks (HTTPSRV-2) and the answer API's panics are each
pinned by a link test that exits 1 with its message, among them
`link/net_http_server_h1_head`, `net_http_server_h1_fields`,
`net_http_server_h2_head`, `net_http_server_h3_head`,
`net_http_server_h2_connect`, `net_http_server_h3_webtransport`,
`net_http_server_wait_tls` and, for `own` (HTTPSRV-3),
`link/net_http_server_foreign: exits with 1 and stdout matches expected.out`.

Not pinned by a test yet: HTTPSRV-4's refusal of a stream past the
per-connection cap and HTTPSRV-5's reset of an HTTP/2 or HTTP/3 stream past
`bodyTimeout`; both need a client that holds streams open, which the
scripted carrier clients do not script.
