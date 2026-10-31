# Security record: the HTTP request handler

The record of WP43's second stage: `nish/net/handler`, the request and
response layer over the HTTP/1.1 carrier
([wp43-http-app-layer.md](../wp43-http-app-layer.md)). It says what the
handler holds per connection and per request, what it refuses and how, what
happens to an answer that outlives its connection, and the test that pins
each property. It is written with the code rather than after an audit, so
that the audit of the HTTP application layer starts from evidence.

Anchors are function names in `std/net/handler.ts` at `4224476`, the last
commit to change it on the head that merges this record.

**Result.** The handler adds no parser of its own: the request line, the
fields, the body framing, the caps and the timeouts are the carrier's
(`docs/security/http1.md`), and routing is the router's
(`docs/security/router.md`). What it adds is bookkeeping — copying a head out
of the carrier, gathering a body, queueing whole requests and handing answers
back — and each piece of it is bounded by a limit the program set: a body by
`http.maxBody` (one MiB by default), a head by the carrier's head cap, the
connections by `slots`. An answer for a request whose connection has closed,
even one whose slot a new connection has taken since, is dropped and never
reaches the new peer. Once warm, a request allocates nothing. Review
before merge found four faults and fixed each with a test that failed
before the fix (HANDLER-9 to HANDLER-12): a draining connection that kept
reading pipelined requests, a listener that spun the loop when an accept
failed for want of descriptors, length checks that missed bytes still
pending, and `sendJson` sending a value no `json()` began. None is left
open. Two properties are the program's, by design, and
are recorded as accepted: how many taken requests it holds unanswered
(HANDLER-7) and what it does with a parameter or query value (HANDLER-8).

## Scope

| File | Functions |
| --- | --- |
| `std/net/handler.ts` | `HandlerLimits`; `HttpRequest` (`methodIs`, `pathIs`, `paramStart`, `paramEnd`, `paramIs`, `param`, `paramDecimal`, `checkParam`, `query`, `hasQuery`, `queryIndex`, `header`, `valueStart`, `valueEnd`, `headerIs`); `HttpHandler` (`watch`, `fired`, `wait`, `drain`, `acceptAll`, `drive`, `roomy`, `begin`, `route`, `gather`, `whole`, `enqueue`, `resume`, `pushPending`, `finish`, `obtain`, `release`, `releaseReading`, `closeSlot`, `forget`, `sweep`, `ready`, `take`, `live`, `pooled`, `connections`, `start`, `write`, `keep`, `end`, `send`, `sendFields`, `empty`, `json`, `sendJson`, `problem`, `writeProblem`, `writeProblemObject`, `refuse`, `allowFor`); the helpers `handlerAllowAppend`, `handlerGrown`, `handlerSpanIs`, `handlerDecimal`, `handlerFormByte`, `handlerFormIs`, `handlerFormDecode` |

Out of scope: the carrier (`std/net/http1-server.ts`, `std/net/http1.ts`;
`docs/security/http1.md`), which has refused a malformed or oversized head,
a bad body framing and a body past the cap before the handler sees a byte of
it; the router (`docs/security/router.md`); and what a program does with a
request once it has taken it. `examples/http-app` is an example, not a
library, and is not in scope.

## Threat model

The attacker is the client: every byte of every request is theirs, they may
open as many connections as the listener accepts, pipeline, send a body
slowly or not at all, and leave at any moment, including while the program
holds their request. A win is a panic, memory or time a request can make the
handler spend beyond the limits the program set, one peer receiving an
answer meant for another, an answer sent out of request order on one
connection, or a request routed differently from what its bytes spell. The
program and its `HandlerLimits` are trusted; misuse of the answer API (a
status outside 200 to 599, a reserved field, more body than the length said,
a second `start`, `sendJson` with no `json()`) panics, since a peer cannot
cause it.

## Findings

Rows HANDLER-1 to HANDLER-6 are the shapes an attacker's traffic can take,
each checked and found to hold; they are recorded so that the audit can see
what was tried. HANDLER-7 and HANDLER-8 are accepted. HANDLER-9 to
HANDLER-12 were fixed before merge and are counted as fixed in the index;
none is open.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| HANDLER-1 | High if it failed | `gather`, `HandlerLimits` | A body must not grow a request's buffer past the cap, whether its length is declared or it is chunked. | **Holds.** The carrier answers 413 for a declared length over `http.maxBody` and for a chunked body that grows past it, and ends the connection; `gather` only appends what the carrier handed over, so a body buffer is at most the cap, and a handler holds at most `slots` times the cap in bodies. A body exactly at the cap is taken whole. |
| HANDLER-2 | Medium if it failed | `begin` | Copying a head out of the carrier must not read or write past either buffer. | **Holds.** `begin` copies `p.headLength` bytes and `4 * headerCount` spans, the parser's own counts, which the carrier's head and field caps bound, into buffers grown to fit first. Every span a program reads afterwards is into that copy. |
| HANDLER-3 | High if it failed | `live`, `finish`, `closeSlot`, `forget` | An answer for a request whose connection closed — the peer left, the idle timeout passed — must not reach whoever holds the slot now. | **Holds.** Each slot carries a generation, bumped when its connection closes, and a request remembers the one it was read under; an answer for a stale generation answers `HANDLER_DROPPED`, sends nothing and hands the request back to the pool. |
| HANDLER-4 | Medium if it failed | `whole`, `resume`, `pushPending` | Pipelined requests must be answered in order, and a peer that never reads must not make the handler buffer answers without bound. | **Holds.** The carrier reads a connection's next request only once the one before it is answered, and `whole` parks a finished request while more than half an output of the answer before it is unsent (`roomy`), so a connection holds one answer in flight. |
| HANDLER-5 | Medium if it failed | `drive`, `sweep` | A slow or silent peer must not hold a slot past the carrier's timeouts, nor its request past its connection. | **Holds.** The carrier's head, body and idle deadlines close the connection; `sweep` then releases the request being read, and one taken is dropped when answered (HANDLER-3). |
| HANDLER-6 | Low if it failed | `queryIndex`, `handlerFormByte`, `handlerFormDecode`, `route` | A malformed escape in the query must not be read past, and HEAD must not reach a route GET does not. | **Holds.** Each escape is checked before it is used; a `%` at the end or with a non-hex digit matches nothing and decodes to `ROUTER_BAD_ESCAPE`, a decoded length past `out` to `ROUTER_NO_ROOM`. A HEAD takes a route only through the router's own match for GET on the same target. |
| HANDLER-7 | Low | `take` | A request the program has taken and not answered stays allocated, even after its connection closes and a new one takes the slot, so a program that never answers grows the pool by one request per connection. | **Accepted.** Answering later is the point of the pull interface; how long the program holds a request is its policy. Answering, even with a dropped result, returns it. `tests/link/net_handler` pins that the pool makes no request past its warm size when every request is answered. |
| HANDLER-8 | Low | `param`, `query` | A decoded parameter or query value may hold `/`, `..`, NUL or any byte. | **Accepted.** As ROUTE-8 and ROUTE-9 record, refusing those is the caller's job; the handler hands the bytes over as ranges and decodes only on request. A query value decodes through `percentDecode` (`docs/security/url.md`) with `URL_DECODE_ALLOW_NUL`, so `%00` is a NUL byte there as it is in a parameter. |
| HANDLER-9 | Medium | `drain`, `begin` | A busy connection kept keep-alive through a drain: once its held request was answered, the carrier read the next pipelined request, so a client that pipelined without end held a draining server open. | **Fixed.** `drain` sets `closeAfter` on each busy connection, and `begin` on each head read while draining: the answer says `Connection: close` and no request behind it is read. Before the fix "a draining connection's answer says it closes" and "and the pipelined request is not read: the connection closes" failed in `tests/link/net_handler`. |
| HANDLER-10 | Medium | `acceptAll`, `wait` | An accept that failed for want of descriptors or memory (EMFILE, ENFILE, ENOMEM) left the connection in the backlog and the listener readable, so every `wait` returned at once: a peer that pushed the process to its descriptor limit made the loop spin a core. | **Fixed.** On any accept error but EAGAIN and ECONNABORTED the listener leaves the loop for 100 ms (`HANDLER_ACCEPT_REST`), and `wait`'s timeout is capped so that it returns. `tests/link/net_handler_descriptors` uses up its own descriptors: "and its turns wait out their timeout rather than spin" failed before the fix, and "once a descriptor is free, the waiting connection is taken" holds. |
| HANDLER-11 | Low | `write`, `end` | `write` and `end` checked a declared length against what the carrier had taken, not counting bytes still pending behind a full output, so a program could send more or less body than its `Content-Length` said without the panic the contract promises, and a client would read the excess as the next response. | **Fixed.** Both subtract the pending bytes before comparing. `tests/link/net_handler_overlong` and `net_handler_short` declare 32 MiB, leave half of it pending and overrun or stop short; each printed `FAIL` and exited 0 before the fix and panics now. |
| HANDLER-12 | Low | `json`, `sendJson`, `writeProblem` | `sendJson` with no `json()` before it sent whatever the shared JSON buffer held — another request's answer, perhaps another client's — and a problem too large for the buffer was sent with an empty body. | **Fixed.** `sendJson` panics unless `json()` began its value (`tests/link/net_handler_unbegun`); a problem that does not fit is written without its detail, then without its title ("a problem too large for the JSON buffer is sent without its detail"). |

## Properties verified

Each property below is pinned by a line of
`tests/link/net_handler/expected.out`, which
`link/net_handler: exits with 0 and stdout matches expected.out` compares
byte for byte. The program drives a real handler over loopback sockets.

**The body cap** (HANDLER-1): "a declared body one byte over the cap is
answered 413", "and the connection ends", "a body exactly at the cap is taken
whole and echoed byte for byte", "a chunked body is gathered whole".

**Late answers** (HANDLER-3, HANDLER-5): "its peer leaves, and the idle
timeout ends the connection before the answer", "the late answer is
dropped", "a new connection on the freed slot is answered", "an answer for
the old connection is dropped though the slot is in use again", "and the new
connection never sees it", "the dropped requests went back to the pool".

**Order** (HANDLER-4): "the first of three pipelined requests is answered
first", "then the second", "then the third".

**Queries and HEAD** (HANDLER-6): "a parameter and a form-decoded query come
back as JSON", "a query without the name leaves it out", "a %00 in the query
decodes to a NUL byte, as in a parameter", "a malformed escape in the query
is the program's 400", "HEAD takes the GET route and is
answered with its length and no body".

**Refusals**: "an unknown path is 404", "as an RFC 9457 problem", "a method
the path does not take is 405", "with an Allow naming GET and DELETE, and
HEAD for the GET", "a problem too large for the JSON buffer is sent without
its detail".

**No allocation per request** (HANDLER-7): "a warm connection answers two
thousand more requests, two pipelined at a time", "and the arena stays
flat", "and the pool makes no request past its warm size".

**The drain**: "a drain closes the idle connection at once", "and keeps the
busy one", "a draining handler accepts no new connection", "the held request
is still answered", "then that connection closes too", "and none are left";
with a request pipelined behind the held one (HANDLER-9), "a draining
connection's answer says it closes", "and the pipelined request is not read:
the connection closes".
`link/net_http_app: exits with 0 and stdout matches expected.out` drives the
same drain through `examples/http-app`.
