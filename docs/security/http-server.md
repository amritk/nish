# Security record: one HTTP server for HTTP/1.1, 2 and 3

The record of WP39's G7 stage: `nish/net/http-server`, one request pool and
one answer API over the HTTP/1.1 carrier (cleartext, and over TLS on a port
of its own), HTTP/2 over TLS, cleartext HTTP/2
(h2c) and HTTP/3
([http-one-handler.md](https://github.com/amritk/nish/blob/main/docs/http-one-handler.md)).
It says what the façade holds per connection and per request, what it
refuses and how, what happens to an answer that outlives its connection or
stream, and the test that pins each property. It is written with the code
rather than after an audit, so that the audit of the HTTP application layer
starts from evidence.

Anchors are function names in `std/net/http-server.ts` at the commit that
adds `listenHttp1Tls`, the last to change it on the head that merges this record.

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

A trailer section on an HTTP/2 answer passes the same outgoing-field check
as a head and is bounded by `maxResponseFields` and the connection's output
(HTTPSRV-13).

A route marked with `streamBody` takes its HTTP/2 body in pieces: the
request is handed over at its head, and the stream's receive window is
credited only as the program consumes, so what one streamed request holds
unconsumed is bounded by one stream window, not by `maxBody`
(HTTPSRV-17). A reset, a lost connection or an early answer hands such a
request back or ends its stream (HTTPSRV-19).

A request on an HTTP/1.1 listener can be upgraded to a WebSocket
(`acceptWebSocket`); its frames are read by the carrier's decoder
(`nish/net/websocket`), and an upgrade on HTTP/2 or HTTP/3 is refused
(HTTPSRV-26). Every way a WebSocket ends hands its request back, a held
message is not overwritten, and a full output stalls an echo rather than
dropping it (HTTPSRV-27); `idleTimeout` ends a quiet one and `bodyTimeout`
does not (HTTPSRV-28).

Four findings were fixed in review: a stream reset while its answer was still
flushing kept its request out of the pool for good (HTTPSRV-12, Medium), a
field a step added could be sent twice beside the one the server adds
(HTTPSRV-16, Medium), an h2c peer that closed its connection part way
through a streamed body left the request with the program, never handed back
(HTTPSRV-18, Medium), and such a request, once handed back, kept its stream
open, so the connection never closed (HTTPSRV-21, Medium).
Two were fixed before HTTP/1.1 over TLS was merged: a connection whose
handshake chose `h2` on the HTTP/1.1 over TLS listener had a request it sent
after its Finished handed to the program (HTTPSRV-22, Medium), and a drain
closed a TLS connection whose sealed response records were still unsent, cutting
its body short (HTTPSRV-23, Medium).
One is left open: the cap that keeps one connection from taking the pool is
per connection, not per peer, so a client with many connections can still
fill it (HTTPSRV-6, Low); a WebSocket holds its request for its whole life,
so many WebSockets can too (HTTPSRV-29, Low).
Three properties are the program's and are accepted: how long it holds a
request it took (HTTPSRV-8), what it does with a decoded parameter
(HTTPSRV-9), and whether its loop runs the steps a route is bound to before
the route body (HTTPSRV-15). So is the nature of h2c, which nothing protects
on the wire (HTTPSRV-11), and the deadline of a streamed body, which
`bodyTimeout` does not keep once the program has the request (HTTPSRV-20).

## Scope

| File | Functions |
| --- | --- |
| `std/net/http-server.ts` | `HttpServerLimits`; `HttpServerRequest` (`methodIs`, `pathIs`, `paramStart`, `paramEnd`, `paramIs`, `param`, `paramDecimal`, `checkParam`, `query`, `hasQuery`, `queryIndex`, `header`, `valueStart`, `valueEnd`, `headerIs`); `HttpServer` (`streamBody`, `consume`, `listenHttp1`, `listenHttp1Tls`, `listenH2c`, `listenHttp2Tls`, `listenHttp3`, `checkHttp2`, `acceptWebSocket`, `sendFrame`, `received`, `closeWebSocket`, `watch`, `fired`, `wait`, `waitSigned`, `turnWith`, `drain`, `connections`, `ready`, `take`, `hungUp`, `before`, `after`, `field`, `start`, `write`, `end`, `send`, `sendFields`, `empty`, `json`, `sendJson`, `problem`, `refuse`, `trailers`, and the private `restListener`, `acceptHttp1`, `acceptHttp1Tls`, `checkHttp1`, `h1Grow`, `h1Record`, `h1Opened`, `h1Holds`, `h1Conn`, `h1ConnOf`, `h1Next`, `h1Flush`, `h1Resting`, `h1Arm`, `driveOf`, `drivePass`, `h1Serve`, `drive`, `starve`, `feedStarved`, `settle`, `roomy`, `begin`, `gather`, `whole`, `resume`, `pushH1`, `finishH1`, `releaseReading`, `h1Close`, `h1Forget`, `h1Sweep`, `h1Ready`, `h1Screen`, `declared`, `growBody`, `sweepCap`, `setAltSvc`, `h3Drained`, `h3Owned`, `obtain`, `admit`, `route`, `append`, `enqueue`, `release`, `drop`, `taken`, `keep`, `own`, `live`, `unlink`, `outFields`, `hasField`, `digits`, `abort`, `carry`, `nudge`, `push`, `writeProblem`, `writeProblemObject`, `allowFor`, `h1Of`, `h2Of`, `h3Of`, `screen`, `fromFields`, `put`, `putField`, `acceptHttp2`, `h2Serve`, `h2Event`, `h2Direct`, `h2Entry`, `h2Find`, `h2Settle`, `h2PushAll`, `moves`, `h2Close`, `h2Forget`, `h3Turn`, `h3Serve`, `h3Event`, `h3Direct`, `h3Entry`, `h3Find`, `h3Clear`, `expireAll`, `late`, `h2Expire`, `h3Expire`, `carryEnd`, `carryTrailers`, `perOf`, `h2Grow`, `rest`, `unlisten`, `acceptH2c`, `clearHttp2`, `h1Sniff`, `h1Decided`, `h1ToH2c`, `h2Opened`, `h2Holds`, `h2Conn`, `h2Next`, `h2Flush`, `h2FdOf`, `h2cOf`, `streamsBody`, `requeue`, `unqueue`, `h2Piece`, `h2Ended`, `socketOf`, `holding`, `frame`, `shut`), and the method `pending`; the helpers `httpServerLimit`, `httpServerAllowAppend`, `httpServerGrown`, `httpServerSpanIs`, `httpServerDecimal`, `httpServerFormByte`, `httpServerFormIs`, `httpServerFormDecode` |

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
cannot cause it. One call is the exception: the client picks the HTTP
version, and `trailers` panics on an HTTP/1.1 or HTTP/3 request, so a
handler behind more than one kind of listener that calls it without
checking `r.version === 2` can be panicked by any client (HTTPSRV-13).

## Findings

Rows HTTPSRV-1 to HTTPSRV-5, HTTPSRV-7, HTTPSRV-10, HTTPSRV-13, HTTPSRV-14,
HTTPSRV-17, HTTPSRV-19, HTTPSRV-24 and HTTPSRV-26 to HTTPSRV-28 are the shapes an
attacker's traffic can take, each checked and found to hold. HTTPSRV-6, HTTPSRV-25 and
HTTPSRV-29 are open. HTTPSRV-8, HTTPSRV-9,
HTTPSRV-11, HTTPSRV-15 and HTTPSRV-20 are accepted. HTTPSRV-12, HTTPSRV-16,
HTTPSRV-18, HTTPSRV-21, HTTPSRV-22 and HTTPSRV-23 were fixed in review, each with a test
that failed before the fix.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| HTTPSRV-1 | High if it failed | `screen`, `fromFields`, `begin`, `route` | A request carried by HTTP/2 or HTTP/3 must not reach a route its own carrier would not, by being re-read as HTTP/1.1 (cross-version smuggling), nor by a `host` that names another authority. | **Holds.** `fromFields` copies the method, the path and each field the carrier decoded into the request's head as ranges; nothing is joined into HTTP/1.1 text and parsed again, so a field value holding CR, LF or a request line stays a value. `:authority` is given as `host` in place of any `host` field, and the carrier has already refused a `host` that names another authority (`HTTP_FIELDS_AUTHORITY_MISMATCH`, a `PROTOCOL_ERROR` reset on HTTP/2 and `H3_MESSAGE_ERROR` on HTTP/3), so the route sees one authority. `link/net_http_fields` pins the check: "a host that names :authority reads", "one that names another is refused". |
| HTTPSRV-2 | High if it failed | `listenHttp1`, `listenHttp1Tls`, `listenH2c`, `listenHttp2Tls`, `listenHttp3`, `screen`, `h2Event`, `h3Event`, `gather` | A head or a body must not grow a request past `maxHead`, `maxFields` or `maxBody` on any version, except a body the program streams on a marked HTTP/2 route, which HTTPSRV-17 bounds instead. | **Holds.** Each listener refuses, at configuration, a carrier whose own caps admit more than the limits: the HTTP/1.1 target and head bytes against `maxHead` and its fields against `maxFields`; HTTP/2's `maxHeaderListSize` (over TLS or h2c, through `checkHttp2`) and HTTP/3's `maxFieldSectionSize` against `maxHead`. `config.maxBody` on HTTP/1.1 is set to `limits.maxBody`. On HTTP/2 and HTTP/3, `screen` answers 431 for a head past either cap and 413 for a declared length past `maxBody` before a request is taken from the pool, and `h2Event` and `h3Event` answer 413 and release the request once DATA would pass `maxBody`, whether a length was declared or not. On HTTP/1.1, `h1Screen` answers CONNECT 501 and `OPTIONS *` 204 before a request is taken. A body grows in tiers (`growBody`): up to `T = min(65536, maxBody)` it doubles from 64 bytes, never past `T`; past `T` it is replaced once by an array of exactly `maxBody`; a declared length is allocated at once, so a head alone that declares more than 64 KiB reserves a `maxBody` array for its pool entry before a body byte comes. So the bodies a server holds stay below `requests × (maxBody + 3T)`, the headers-only case included. Each request's `pending` buffer, the answer bytes its carrier had no room for yet, grows to `min(2^30, max(needed, 2 × current))`; a `write` whose remainder would pass 2^30 answers `HANDLER_DROPPED` and keeps nothing. A drain's datagram buffer is `HTTP_SERVER_UDP_SIZE`, 64 KiB. `link/net_http_server` pins the tiers with a `maxBody` of 1048575, not a power of two: "eight chunked bodies of maxBody 1048575 are held in arrays of exactly maxBody", "below 8 × (maxBody + 192 KiB)", which read the held arrays' own lengths, and "eight held bodies of 1000 bytes are each in an array of at most 64 KiB, not maxBody", which reads each array too: `Arena.used` counts only the newest chunk, and an array past 64 KiB takes a chunk of its own, so an arena total would not see a `maxBody` array. `link/net_http_server_lifecycle` pins the same on h2c, "and each holds its body in at most 64 KiB, not maxBody's 1 MiB", which failed with a `growBody` that always allocated `maxBody`; and the head caps: "16400 bytes of fields are answered 431", "a 9000-byte target is answered 414", "a chunked body past the cap is answered 413". `link/net_http_server_matrix` pins the h2c and HTTP/3 screen with a `maxBody` of 1000: "a declared body past maxBody 1000 is answered 413", "an undeclared one is answered 413 when it passes it", "100 fields past the pseudo-headers are answered 431", on each. |
| HTTPSRV-3 | High if it failed | `live`, `own`, `h1Close`, `h2Close`, `h3Clear`, `drop` | An answer for a request whose connection closed or whose stream was reset must not reach whoever holds the slot or stream now, and an answer through another server must not reach that server's peers. | **Holds.** Each slot of each carrier carries a generation, bumped when its connection closes, and a request remembers the one it was read under; a reset stream marks its request `hung`. `live` checks both, and an answer for a stale one answers `HANDLER_DROPPED`, sends nothing and hands the request back; a reset hands back a request in any state the program no longer holds (HTTPSRV-12). `hungUp` reads true for each of those, and on HTTP/1.1 and HTTP/2 also once the peer's byte stream ends, a half-close included, whose answer may still be delivered. `link/net_http_server_lifecycle` pins it under a pool of one, for an h2c RST_STREAM, an h2c socket closed, an HTTP/3 RESET_STREAM with STOP_SENDING and an HTTP/3 CONNECTION_CLOSE: "the held request reads hungUp", "and send answers HANDLER_DROPPED" (for the closed socket, "and send ends it, SENT or DROPPED", since whether the kernel still takes the write is timing), "then the next request is served on the returned entry" ("h2c socket closed: the held request reads hungUp" failed before `hungUp` read the HTTP/2 byte stream's end). `own` checks that a request belongs to this server's pool before any answer reads its slot, and panics if not, so a program with two servers cannot send one server's request out over the other's connection with a matching slot and generation. |
| HTTPSRV-4 | Medium if it failed | `listenHttp2Tls`, `listenHttp3`, `obtain`, `h2Entry`, `h3Entry` | One connection must not take every request in the pool, so that HTTP/1.1, HTTP/2 and HTTP/3 clients share it. | **Holds** per connection. An HTTP/2 or HTTP/3 connection holds at most `max(1, min(maxStreams, requests / 4))` requests (`maxStreamsBidi` on HTTP/3); a stream past that, or past a full pool, is refused with `REFUSED_STREAM` or `H3_REQUEST_REJECTED`, which a client may retry. An HTTP/1.1 connection holds one request, and with the pool full it stops being read until one is free (`starve`, `feedStarved`). See HTTPSRV-6 for many connections. `link/net_http_server_caps` pins it with clients that hold streams open on `/slow`: at `requests` 8, "requests 8, h2c: two streams held on one connection, the third refused", "four connections hold two each: the pool of eight is full" and "a fifth connection's stream is refused" on h2c, and "a fifth connection's stream is H3_REQUEST_REJECTED" on HTTP/3; at `requests` 1, 2 and 3, "a connection's second stream is refused" and "the next connection's stream is refused" (h2c) or "is H3_REQUEST_REJECTED" (HTTP/3). For HTTP/1.1, `link/net_http_server` pins the full pool at `requests` 1: "under requests 1 a held request takes the only pool entry", "a second connection's request waits unread while the pool is empty". |
| HTTPSRV-5 | Medium if it failed | `wait`, `expireAll`, `late`, `h2Expire`, `h3Expire`, `h1Sweep`, `listenH2c`, `listenHttp1Tls` | A slow or silent peer must not hold a request past a deadline on any version, while the server reads its body; a streamed request is the program's from its head (HTTPSRV-20). | **Holds.** `bodyTimeout` runs from the turn a head was read (`since`); `expireAll` ends a request still reading past it: the HTTP/1.1 connection closes, the HTTP/2 or HTTP/3 stream is reset, and the request goes back to the pool. An HTTP/2 connection with no open stream closes after `idleTimeout`, which also bounds a handshake that never finishes; an h2c connection that has not sent its preface is closed by its carrier after `prefaceTimeout`, and `idleTimeout` runs from its preface. HTTP/1.1 and HTTP/3 keep their carriers' own idle timeouts (HTTP/3's is QUIC's `maxIdleTimeout`); over TLS, HTTP/1.1's idle and head timeouts run through `Http1TlsServer.expire`, which `wait` calls beside the cleartext carrier's `expire` before the one `h1Sweep`, and the idle timeout also bounds a handshake that never finishes. `link/net_http_server_carriers` pins both h2c deadlines: "an h2c connection that never sends its preface is closed by prefaceTimeout", "one silent after its preface is closed by idleTimeout". `link/net_http_server_timeouts` pins `bodyTimeout` on h2c ("a body that never comes has its stream reset CANCEL") and HTTP/3 ("its stream is reset H3_REQUEST_CANCELLED and its sending stopped"), and `idleTimeout` over TLS ("a connection with no stream is closed"). `link/net_http_server_h1_tls` pins HTTP/1.1 over TLS: "idleTimeout 100: a handshake, then silence", "is closed by the server"; "a head that stops part way is closed by the server", "and not handed to the program" (`headTimeout`); "a body that stops after 2 of 10 bytes is closed by the server", "never handed to the program" (`bodyTimeout`). As HANDLER-5 records, the deadline is checked only when `wait` returns. |
| HTTPSRV-6 | Low | `listenHttp2Tls`, `listenHttp3`, `acceptHttp1`, `acceptHttp1Tls`, `acceptHttp2` | The per-connection cap (HTTPSRV-4) bounds a connection, not a peer: a client that opens four HTTP/2 or HTTP/3 connections, or `requests` HTTP/1.1 connections, and sends heads with no body can hold the whole pool until `bodyTimeout` ends them, and every other client's stream is refused meanwhile. | **Open.** A per-address bound needs the peer's address, which the façade does not see, and is a deployment's policy: a proxy, a firewall's connection limit, or the carriers' `slots`. The pool's fill is bounded in time by `bodyTimeout` (HTTPSRV-5), except by requests on a streaming route, which hold their entries for as long as the program waits (HTTPSRV-20), and a refused HTTP/2 or HTTP/3 stream is retryable. |
| HTTPSRV-7 | Low if it failed | `outFields`, `listenHttp3` | The Alt-Svc field must come only from configuration, never from a request, and must not be sent in cleartext HTTP/2, where an on-path attacker could not be told apart from the server that advertised it. | **Holds.** `listenHttp3` builds it once from the UDP socket's own port, or `altSvcPort`, and `altSvcMaxAge`; `outFields` adds that buffer to each HTTP/1.1 answer and each HTTP/2 over TLS answer whose own fields name no `alt-svc`, and to no h2c answer (`r.secure` false). No byte of a request reaches it. `link/net_http_server_carriers` pins "every stream ended, and no alt-svc on any" over h2c, and with `altSvcMaxAge` 0 "HTTP/2 over TLS says alt-svc: clear", "h2c says nothing of alt-svc". |
| HTTPSRV-8 | Low | `take` | A request the program has taken and not answered stays allocated after its connection closes. | **Accepted**, as HANDLER-7: how long the program holds a request is its policy. Answering, even with a dropped result, returns it, and the pool never grows past `requests`. |
| HTTPSRV-9 | Low | `param`, `query` | A decoded parameter or query value may hold `/`, `..`, NUL or any byte. | **Accepted**, as HANDLER-8 and ROUTE-8: refusing those is the caller's job, and the guide page says so. |
| HTTPSRV-10 | High if it failed | `h2Grow`, `h2Holds`, `h2Conn`, `h2Event`, `live` | HTTP/2 over TLS and h2c share one table of slots, generations and stream entries; an answer or a request must not cross from a connection of one into a slot of the other, and growing the table for the second listener must not move a request already taken. | **Holds.** Each listener owns a fixed range of virtual slots, given when it is configured (`h2TlsBase`, `h2cBase`), and every per-slot call goes to the carrier that owns the range (`h2Clear` says which), so a slot index means one connection of one carrier. `h2Grow` widens the per-slot stream table to the larger of the two listeners' caps and remaps the entry of each HTTP/2 request already in the pool, so `live`'s slot and generation check (HTTPSRV-3) still names the same connection. `r.secure` is set from the owning carrier, false on h2c. |
| HTTPSRV-11 | Medium | `listenH2c` | An h2c connection is neither encrypted nor authenticated: anyone on the path reads and rewrites every request and answer. | **Accepted.** That is what h2c is; the guide page says to serve it only behind a proxy that ends TLS, or on a trusted network. The façade adds nothing on top that would claim otherwise: `r.secure` is false and no Alt-Svc is sent (HTTPSRV-7). |
| HTTPSRV-12 | Medium | `h2Close`, `h3Clear`, `release`, `drop` | A stream reset while its answer was still flushing left its request outside the pool for good, so a client that reset enough streams emptied the pool and every later stream was refused. | **Fixed.** A reset now hands back a request in any state the program no longer holds (commit `2fa11bf`). `link/net_http_server_carriers` pins it with a pool of one: "the reset handed the request back: the next stream is answered, not refused", which failed before the fix. |
| HTTPSRV-13 | Medium if it failed | `trailers`, `push`, `carryTrailers` | A trailer section the program ends an HTTP/2 answer with must not split the answer or smuggle a field the head could not carry, must not grow past `maxResponseFields` or the connection's output, and must not be sent on a carrier that has no trailers in the façade (HTTP/1.1, HTTP/3). | **Holds.** `trailers` runs the same `httpFieldsCheckOutgoing` as a head, so a name that is not a lowercase token (a pseudo-field included), a connection-specific field, or a value with CR, LF or NUL panics before anything is written. More fields than `maxResponseFields` reset the stream and answer `HANDLER_DROPPED`, on a HEAD, 204 or 304 answer too, since the count is checked before a quiet answer's trailers are set aside; a section larger than the connection's output buffer answers `HANDLER_SENT`, is `H2_INVALID` from `Http2Connection.writeTrailers` when it comes to be sent, and `carryTrailers` resets the stream. On HTTP/1.1 and HTTP/3 the call panics, and that panic is the program's to avoid: the peer picks the version, so a handler that does not check `r.version === 2` first is panicked by any HTTP/1.1 or HTTP/3 client. `trailers` keeps the caller's `names` and `values` arrays and `carryTrailers` reads them when it sends, which can be after the call returns; a program that reuses one pair across requests sends what they hold then. The section goes only after the body's last byte, as one HEADERS frame with END_STREAM, and a HEAD, 204 or 304 answer, whose head ended the stream, sends none. A call after `end`, or after an earlier `trailers`, finds the answer no longer streaming and panics; `net_http_server_trailers_after_end` pins the first. |
| HTTPSRV-14 | Medium if it failed | `before`, `after`, `field`, `admit`, `start`, `outFields` | A step (WP43 stage 5) must run only for the route `Router.use` bound it to, on every version; a step that answers a request must stop the route body and every later step; and a field a step adds must not reach another request's answer, split the head, set a field the carrier reserves, or grow an answer without bound. | **Holds.** `before` and `after` run the same algorithm as the handler's (HANDLER-14), with an `own` check in front, over the request the façade laid out, so a request on HTTP/1.1, h2c or HTTP/3 runs the same steps in the same order. `admit` clears `stepped` and `added` for every request it lays out, whichever carrier read it. `field` keeps at most `HANDLER_MAX_ADDED` (16) fields and a seventeenth panics (`tests/link/net_http_server_steps_full`). `outFields` puts the added fields beside the answer's own, counts them against `maxResponseFields` (an answer over it is dropped as one the program gave too many fields is: the HTTP/1.1 connection ends, the HTTP/2 or HTTP/3 stream is reset), and hands them to the carrier's `respond`, so they meet the checks the program's own fields meet: on HTTP/1.1 a reserved name or a value holding CR LF is `H1_INVALID` and `start` panics before a byte of the head is written (`tests/link/net_http_server_steps_split`); on HTTP/2 and HTTP/3 the field-section checks of HTTPSRV-13 apply. Of those paths only the HTTP/1.1 CR LF refusal is run by a test; the count against `maxResponseFields` and the h2 and h3 refusals of a step's reserved or invalid field hold by reading `outFields` and the carriers' `respond`, and no test drives a step's fields over the cap or a bad step field on h2c or HTTP/3. The answers a carrier or the façade sends itself, to a malformed or oversized request, a timeout or a full pool, never reach `take`, so they run no step. |
| HTTPSRV-15 | Low | `before`, `after` | A step runs only when the program's loop calls `before` and acts on what it answers, so a loop that skips it runs the route body unguarded. | **Accepted**, as HANDLER-15: steps are pulled and the loop is the program's. `before` and `after` here run the same algorithm as the handler's pair, with an `own` check in front; their cost was not measured (HANDLER-15 states the handler's), and a loop that calls neither pays nothing per request for them. The guide page (`docs/guide/using-nish/http-server.md`, "Steps before and after a route") shows the one to copy. |
| HTTPSRV-16 | Medium | `outFields` | A field a step adds must not be sent twice: the server adds `content-length` on HTTP/2 and HTTP/3, and `alt-svc` on HTTP/1.1 and HTTP/2 over TLS, only when the answer carries none. Before the fix `outFields` looked only at the program's own fields, so a step that added either one sent the answer with two of it (two `content-length`s on an HTTP/2 or HTTP/3 stream, which a client must treat as malformed and an intermediary may read two ways). | **Fixed.** `outFields` now looks for the name among the step's added fields too, and adds its own only when neither gave one. `link/net_http_server_steps` pins it on the route `/sized`, whose step adds both: "HTTP/1.1 /sized: one alt-svc, the server adds none beside the step's", "h2c /sized: one content-length, the server adds none beside the step's" and "HTTP/3 /sized: one content-length, the server adds none beside the step's", the three of which failed before the fix. |
| HTTPSRV-17 | High if it failed | `streamBody`, `h2Event`, `h2Piece`, `consume`, `h2Settle`; `Http2Connection.hold`, `consumeBody`, `settleCredit` | A streamed body is read past `maxBody`, so what the server holds of it must be bounded some other way, and a route's mark must not lift `maxBody` where nothing else bounds the body. | **Holds.** A request is streamed only on HTTP/2, only when its route is marked and its head did not end the stream; `h2Event` then calls `Http2Connection.hold`, after which the stream's DATA credits the connection's window on arrival but the stream's own only through `consumeBody`, which `consume` calls with the bytes the program hands back and which credits no more than the stream was sent (`owed`); a WINDOW_UPDATE with no room in the output stays owed, and `h2Settle` sends it through `Http2Connection.settleCredit` once a flush makes room. `link/net_http2_stream` pins the credit at the carrier: "credits the 600 sent, no more", "a consume with no room for its WINDOW_UPDATE: H2_AGAIN", "once drained, settleCredit sends what was owed", the last of which failed with the owed flag never set. A peer that sends past the window it was given gets RST_STREAM FLOW_CONTROL_ERROR from the carrier, so the bytes a streamed request holds unconsumed never pass the stream window: `max(initialWindowSize, 65535)` of the listener's `Http2Config` until the peer acknowledges its SETTINGS, exactly `initialWindowSize` after, which the program sets. The array is the pool entry's own: `admit` reserves nothing for a declared length on a request that streams, and `h2Piece`, when a piece does not fit, grows it by doubling from 64 bytes but never past the window. So a streamed request adds nothing to HTTPSRV-2's bound but an array of at most one window: per pool entry, the larger of the two. The total a streamed body may reach is not bounded: the program reads it as it comes. A declared length past `maxBody` is still 413 on an unmarked route, as is DATA past it; with any route marked, such a request takes a pool entry before its route is known, so with the pool full it is refused REFUSED_STREAM, which a client may retry, rather than answered 413; HTTP/1.1 and HTTP/3 ignore the mark and keep the whole body under `maxBody`. `link/net_http_server_stream` pins it on HTTP/2 over TLS and on h2c with a `maxBody` of 1000 and a body of 300000 bytes: "never more than one stream window held", "the body array never longer than the window", "one byte past the window resets the stream FLOW_CONTROL_ERROR", "no WINDOW_UPDATE for a stream nothing consumed", "a declared length past maxBody is still 413", and "HTTP/1.1: a body past maxBody is 413 on a marked route". |
| HTTPSRV-18 | Medium | `h2Serve`, `h2Ended` | An h2c peer that closed its connection part way through a streamed body left the request with the program, waiting for a piece that would never come: the connection lingers while its streams are open, so no generation moved and nothing handed the request back, and its pool entry stayed taken for as long as the program waited. | **Fixed.** When an HTTP/2 connection's input has ended, `h2Ended` marks each streamed request on it whose body has not ended hung up and hands it back to the program once (commit `1de1312`). `link/net_http_server_stream` pins it: "h2c: a body whose connection closed comes back hung up", which failed before the fix, "the lost request's answer is dropped"; the same two pass over TLS. |
| HTTPSRV-19 | High if it failed | `h2Piece`, `requeue`, `unqueue`, `release`, `ready` | A streamed request whose stream is reset or whose connection is lost must reach the program again as hung up, and its answer must go nowhere (HTTPSRV-3); one answered before its body ended must not keep the peer sending into nothing; and a request queued twice must not be taken twice or outlive its release in the queue. | **Holds.** `h2Piece` marks a reset, drops the request (HTTPSRV-3) and queues it again through `requeue`, which queues a request the program holds at most once until `take` hands it over; `release` takes a second place out of the queue (`unqueue`), so a request answered while queued again is not taken after it is free. A request reset before the program first took it is released by `ready` unseen, as a whole-body one is. A request queued again and answered since (`end`, `trailers`) is flushing on its own, and `ready` skips its queue place rather than hand it to `take` a second time; review found it handed back, and "a request answered since it was queued again stays out of take" failed before the fix. An answer before the body ends is followed by RST_STREAM NO_ERROR (RFC 9113 §8.1); with no room in the output for that frame the stream stays held, so the peer stops at the window. DATA for a streamed request already answered and still flushing is credited back at once. The second queue place (`unqueue`) and that credit are by construction; no test reaches them. `link/net_http_server_stream` pins the rest on both carriers: "a cancelled body comes back hung up", "the cancelled request's answer is dropped", "the unconsumed request comes back hung up", "the unconsumed request's answer is dropped", "the answer goes out with the body unfinished", "then RST_STREAM NO_ERROR for the rest". |
| HTTPSRV-20 | Low | `late`, `take` | `bodyTimeout` runs only while the server reads a body; a streamed request is the program's from its head, so a peer that sends its head and then nothing holds a pool entry, and up to one stream window, for as long as the program waits. | **Accepted**, as HTTPSRV-8: how long the program waits for a piece is its decision. The guide page says to keep a deadline of its own for each streamed request and to answer one that misses it (a 408, say), after which the server resets the rest of its stream with NO_ERROR, as for any early answer (HTTPSRV-19). |
| HTTPSRV-21 | Medium | `h2Ended`, `release`, `live` | A streamed request whose connection's input ended was handed back hung up, but its stream stayed open: `release` resets only a live request's stream, so the connection, which closes when no stream is open, lingered for good, and its socket's hang-up woke every turn of the loop without end. | **Fixed.** `h2Ended` resets the stream CANCEL when it hands the request back (commit `325de11`). `link/net_http_server_stream` pins it: "h2c: and the connection it was on closes", which failed before the fix, and the same over TLS. |
| HTTPSRV-22 | Medium | `h1Next`, `listenHttp1Tls` | The HTTP/1.1 over TLS listener must serve only a connection whose handshake chose `http/1.1` or no protocol. `Http1TlsServer` shuts a slot with another ALPN down, and its own refusal reads the TLS state, which that shutdown moves past open; so a client that offered only `h2` to a listener offering `http/1.1` and `h2`, and sent a GET right after its Finished, had that GET read and handed to the program as an HTTP/1.1 request. | **Fixed.** `h1Next` reads the slot's chosen protocol and answers `H1_ERROR`, which closes the slot, unless it is `""` or `http/1.1`, before it asks the carrier for an event, in the change that adds the listener. `link/net_http_server_h1_tls` pins it: "then the server closes" and "no request taken" both failed in a run of the test with that check removed, and "with close_notify, and no HTTP byte" passed in it, so it does not pin the fix alone; and, against a listener offering `http/1.1` alone, "but a fatal no_application_protocol alert", "and the connection closed, no request taken". |
| HTTPSRV-23 | Medium | `settle`, `drain`, `h1Sealing` | A drain must not cut a response short: an HTTP/1.1 connection over TLS whose answer is written must stay open until every sealed record of it is sent. The drain closed a TLS slot once `Http1Connection.wantsWrite` was false, but the connection's bytes are sealed into records the TLS carrier holds and sends later, and `TlsTcpServer.close` makes one send attempt; so a large response, or a client reading slowly, during a drain lost the rest of its body and its close_notify. | **Fixed.** A draining TLS slot with no request held is closed only once its flush answers no `H1_WANT_WRITE` and its connection is not ending (`h1Sealing`); one that is ending runs through its carrier's shutdown to `H1_DONE`, whose close_notify is sent before the slot closes, so its close waits for the client to hang up, bounded by `idleTimeout`. `link/net_http_server_h1_tls` pins it with an 8 MiB body, drained while the client has read none of it: "every body byte arrived" and "then close_notify" both failed before the fix, in a run of the test with `std/net/http-server.ts` stashed; "and closes the slot once the client hangs up" pins the close. |
| HTTPSRV-24 | Medium if it failed | `listenHttp1`, `h1Opened`, `h1Sniff`, `h1Decided`, `h1ToH2c`, `expireAll`, `drain` | A `listenHttp1` opted in with `h2c` reads a new connection's first bytes, up to 24, before either carrier sees them. The read must lose no byte of an HTTP/1.1 request, send nothing before it decides, hand only a whole preface to h2c, answer a `PRI` request as HTTP/1.1, not hold a partial preface past a deadline, and leave an h2c peer the carrier cannot take closed rather than held. | **Holds.** `h1Sniff` reads into the slot's own 24-byte `head` and compares each byte with the preface as it arrives. At the first that differs, or at the peer's end, `h1Decided` feeds every byte read to the slot's `Http1Connection`, which parses them as if it had read them itself. All 24 matching, `h1ToH2c` takes the socket back with `Http1Server.release` and gives it to `Http2CleartextServer.adopt` with the 24 bytes; a full h2c pool closes it. Nothing is written before either. `expireAll` closes a slot that has read part of a preface and nothing more `prefaceTimeout` after it opened, so a silent peer holds one HTTP/1.1 slot and its 24 bytes until then; `drain` closes a slot still deciding, which holds no request, as it closes an idle one. `h1Opened` sniffs only when the listener made `head` arrays, which only the `h2c` argument does. The checks, each failing without its guard: `link/net_http_server_h2c_preface` (a preface split after 10 bytes: "after ten bytes: 0 bytes back, ended false", then "version 2" and "first frame type 4"); `link/net_http_server_h2c_preface_partial` (23 matching bytes one write a byte, then "X": "after 23 bytes: 0 bytes back" where a default port has already sent 118, then "HTTP/1.1 505 HTTP Version Not Supported, taken false"; fails when the sniff decides early, so sends nothing before 24 bytes and hands 23 to HTTP/1.1, not h2c); `link/net_http_server_h2c_preface_h1` ("version 1", "HTTP/1.1 200 OK": fails if a byte read ahead is lost); `link/net_http_server_h2c_preface_pri` (`PRI * HTTP/1.1` is handed to the program as an HTTP/1.1 request and answered, "version 1, PRI true" and "HTTP/1.1 200 OK", on an opted-in port as on a default one); `link/net_http_server_h2c_preface_ended` (12 bytes of the preface, then the peer's end: "0 bytes back, ended true, taken false" on both ports; fails when the end is not handed to HTTP/1.1); `link/net_http_server_h2c_preface_silent` ("ended true" after `prefaceTimeout` 200 with `idleTimeout` 60 s, which fails without the `expireAll` clause); `link/net_http_server_h2c_preface_drain` ("after drain: 0 bytes back, ended true"; fails when `drain` skips a deciding slot); `link/net_http_server_h2c_preface_full` (on a one-slot listener the second h2c peer gets "0 bytes back, ended true" while the first is served "version 2"; fails when `adopt` keeps the socket of a full pool). A failed read while deciding is HTTPSRV-25. `link/net_http_server_h2c_default_refused` shows a preface on a default port answered "HTTP/1.1 505 HTTP Version Not Supported" and never handed to the program, "taken: false", as before. |
| HTTPSRV-25 | Low | `h1Sniff` | A read that fails while a slot decides (`netRead` answering an error other than "nothing waiting") must hand the slot to HTTP/1.1, which reads the socket again and closes it, as a default port does. | **Open, untested.** `h1Sniff` takes the same `n <= 0` branch for a failure as for the peer's end, which `link/net_http_server_h2c_preface_ended` checks; no check provokes a failed read on a loopback socket, so the failure path is read from the code only. |
| HTTPSRV-26 | High if it failed | `acceptWebSocket`, `frame`, `drivePass` | A WebSocket must be served only on an HTTP/1.1 connection whose request is a valid opening handshake, and its frames must be read by `nish/net/websocket`'s decoder and nothing else: an upgrade on HTTP/2 or HTTP/3 (RFC 8441's extended CONNECT) is out of scope and must be refused, a request without the handshake's fields must not become a socket, and a client frame that breaks the protocol must end the connection with the decoder's code. | **Holds.** `acceptWebSocket` answers `H1_INVALID` for a request whose `kind` is not HTTP/1.1, before it looks for a connection, and otherwise hands the handshake's check to `Http1Connection.acceptWebSocket`, which answers `H1_INVALID` for a request that is not one; the program answers either with a status, and the request stays an HTTP request. A frame the decoder refuses is an `H1_ERROR` from the carrier, which has sent its close; `drivePass` marks the program's WebSocket closed with the carrier's `status`. The checks, each run with its guard removed in a mutation of `std/net/http-server.ts`: `link/net_http_server_ws` "acceptWebSocket answers H1_INVALID on HTTP/2" (fails without the `kind` check, when `acceptWebSocket` answers `H1_CLOSED`), "and the program answers it 400"; "a GET with no Upgrade: acceptWebSocket answers H1_INVALID", "no request was upgraded"; "an unmasked client frame is closed with 1002", and "the program saw it closed with 1002" (fails when `drivePass` marks it with another code). Every case of the Autobahn fuzzing client is run against `tests/link/net_http_server_ws/autobahn.ts` by the `autobahn` job of `.github/workflows/interop.yml`, which fails unless each is OK or INFORMATIONAL. |
| HTTPSRV-27 | High if it failed | `frame`, `shut`, `holding`, `h1Forget`, `sendFrame`, `received`, `closeWebSocket` | A WebSocket holds a pool request for its life, so every way it ends must hand that request back and tell the program once; a message the program holds must not be overwritten by the next frame; and an echo stopped by a full output must resume, not drop the rest. | **Holds.** A close from the peer, a protocol error and the connection's end (`h1Forget`, 1006) each go through `shut`, which marks `closed` once and queues the request; the program's `closeWebSocket` moves it to flushing, and the slot's close drops it into the pool. `holding` stops the slot's reads while a message is held and the output is not stalled, so nothing is read past it until `received`. `sendFrame` answers `H1_AGAIN` with nothing sent when the output is full, and the carrier's `H1_WRITE` sets `writable` and queues the request again. The checks, each failing in a mutation without its guard: "the program saw it closed with 1006" and "every WebSocket was handed back" (without `h1Forget`'s `shut`); "a client that stops reading stalls the echo on H1_AGAIN", "the echo went on when the connection was writable again" and "every message sent while it stalled came back whole" (without `holding`'s check; the last two also without `frame`'s `H1_WRITE` branch); "a pool of one serves three WebSockets one after another"; "the program's own close does not come back as closed"; and "200 warmed round trips are echoed", "and leave the arena where it was (0 bytes kept)", which reads `Arena.used()` around every server call of the round trips. |
| HTTPSRV-28 | Medium if it failed | `late`, `h1Sweep`, `h1Forget` | A WebSocket may be quiet for longer than a body may take, so `bodyTimeout` must not cut it off, but a quiet connection must still end at the listener's `idleTimeout`. | **Holds.** `late` reads only a request still reading its body (`HTTP_SERVER_READING`), and a WebSocket is in `HTTP_SERVER_SOCKET`; the HTTP/1.1 carrier's `expire` closes a slot idle past `idleTimeout` whether it carries HTTP or a WebSocket, and `h1Sweep` hands the WebSocket back closed with 1006. `link/net_http_server_ws`: "bodyTimeout 1: a WebSocket quiet for 1.5 s is still open" and "and still echoes" fail when `late` also reads a WebSocket; "idleTimeout 300: a quiet WebSocket's connection is closed", "and the program saw it closed with 1006" and "and handed it back" (the last two fail without `h1Forget`'s `shut`). |
| HTTPSRV-29 | Low | `acceptWebSocket`, `obtain` | A WebSocket keeps its pool request until it closes, so a client with many WebSocket connections can hold the pool for as long as it keeps each one active inside `idleTimeout`, and HTTP/2 and HTTP/3 clients find it full. | **Open.** The bound is the HTTP/1.1 listeners' `slots`, each connection holding one request; as HTTPSRV-6, a cap per peer belongs in front of the server. `link/net_http_server_ws` "a pool of one serves three WebSockets one after another" shows that a WebSocket holds its request until it closes, and a second one opens only after. |

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

HTTP/1.1 over TLS is pinned by
`link/net_http_server_h1_tls: exits with 0 and stdout matches expected.out`,
whose scripted client drives the listener beside a cleartext one: "a TLS
handshake offering http/1.1, the server's signature and Finished verified",
"a GET of /hello: 200 and its body, with alt-svc naming the HTTP/3 port"
(HTTPSRV-7), "every request was taken, and said secure", "which did not say
secure" (the cleartext GET), "and the server's waitSigned and send kept 0
arena bytes for them" over 32 warmed requests, "is served as HTTP/1.1: 200
hello" with no ALPN, the ALPN refusals of HTTPSRV-22, the drain of
HTTPSRV-23, and `idleTimeout`, `headTimeout` and `bodyTimeout` (HTTPSRV-5):
"is closed by the server", "never handed to the program". With the TLS
listener configured first, so its connections take records 0 and 1 and the
cleartext one the records after: "the second connection, on the TLS
carrier's record 1, is answered", "the first, asking Connection: close, is
answered", "then shut down with close_notify", "a cleartext GET, on the
records after the TLS ones: 200 hello" and "drain closes the idle TLS
connection left". Its configuration panics exit 1 with their message:
`link/net_http_server_h1_tls_twice`, `net_http_server_h1_tls_wait` and
`net_http_server_h1_tls_slots`.

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

Trailers (HTTPSRV-13) are pinned by
`link/net_http_server_carriers: exits with 0 and stdout matches expected.out`,
on HTTP/2 over TLS and on h2c, by the frames a scripted client reads back:
"HTTP/2: then the trailer section, a HEADERS frame with END_STREAM",
"HTTP/2: /trailers-bare: the head, then the trailer section, and no DATA",
"HTTP/2: more trailer fields than maxResponseFields reset the stream",
"HTTP/2: a trailer section too large for the output resets the stream",
"HTTP/2: a HEAD of /trailers: the head ends the stream, and no trailer
section follows", each again for h2c; behind a body that waits for window,
"then the trailer section with END_STREAM"; and on a stream the client
reset, "and trailers answers HANDLER_DROPPED". The panics each exit 1 with
their message: `link/net_http_server_trailers_h1`,
`net_http_server_trailers_h3`, `net_http_server_trailers_fields` (an
uppercase name), `net_http_server_trailers_unstarted`,
`net_http_server_trailers_ended` (a head that declared a length of 0),
`net_http_server_trailers_short` (a body short of its declared length) and
`net_http_server_trailers_after_end` (a call after `end`).

**Steps** (HTTPSRV-14): lines of `tests/link/net_http_server_steps/expected.out`,
which `link/net_http_server_steps: exits with 0 and stdout matches expected.out`
compares byte for byte, on HTTP/1.1, h2c and HTTP/3 in turn: "HTTP/1.1
/stepped: 200 with x-request-id 0 and x-tag", "HTTP/1.1 /stepped: id, the
body, then tag", "HTTP/1.1 /guarded with no authorization: 401 carrying
x-request-id 1, no x-tag", "HTTP/1.1 /guarded refused: the body never ran",
"HTTP/1.1 /hello, bound to no step: 200 with neither field", the same for
h2c ("h2c /guarded refused: the body never ran", "h2c /hello, bound to no
step: 200 with neither field") and HTTP/3 ("HTTP/3
/hello, bound to no step: 200 with neither field"), and "nine requests
named, one per stepped request". A seventeenth field panics
(`link/net_http_server_steps_full`, which prints "16 fields added" first and
exits 1), and a step's value holding CR LF makes `start` panic before the
head is written (`link/net_http_server_steps_split`, which exits 1 with the
carrier's refusal on stderr). `tests/link/net_handler_steps_split` pins the
same refusal through `nish/net/handler`.

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
  per-connection caps, are not bounded by the façade, which is
  configuration, and trusted, with one exception: `checkHttp1` panics when
  a listener's `slots`, with the other HTTP/1.1 listener's if there is
  one, pass 1048576, since a slot's record index is its poll token and
  must stay below the HTTP/2 ones (`link/net_http_server_h1_tls_slots`).
- The body-deadline rows of `link/net_http_server` depend on timing: they
  trickle within the idle timeout and wait past `bodyTimeout`.
- A drain leaves a WebSocket open until the program closes it or its
  connection ends, as it leaves a request the program holds (HTTPSRV-8).
  No check drives a drain with a WebSocket open; this is read from the code.
  Nor does one drive a request read during a drain into `acceptWebSocket`,
  which clears the connection's close-after mark, so that WebSocket also
  stays open until the program closes it; untested, read from the code.
- When `acceptWebSocket` answers `H1_AGAIN` (the 101 did not fit the
  output), nothing hands the request back once the output drains, since
  `resume` passes over a request the program holds; the program must call
  `acceptWebSocket` again itself. A 101 is about 130 bytes and the output is
  at least half free when a request is read, so this is unlikely in
  practice; untested, read from the code.
- During a drain the HTTP/3 listener takes no new connection: `h3Drained`
  drops an Initial for an unknown connection, and `h3Owned` checks a
  datagram's DCID against the connections still open.
