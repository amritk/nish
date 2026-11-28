# Security record: the HTTP request handler

The record of `nish/net/handler`, the request and response layer over the
HTTP/1.1 carrier. It says what the
handler holds per connection and per request, what it refuses and how, what
happens to an answer that outlives its connection, and the test that pins
each property. It is written with the code rather than after an audit, so
that the audit of the HTTP application layer starts from evidence.

Anchors are function names in `std/net/handler.ts` at `d212c29e`, the last
commit to change it on the head that merges this record.

**Result.** The handler adds no parser of its own: the request line, the
fields, the body framing, the caps and the timeouts are the carrier's
(`docs/security/http1-codec.md`), and routing is the router's
(`docs/security/router.md`). What it adds is bookkeeping — copying a head out
of the carrier, gathering a body, queueing whole requests and handing answers
back — and each piece of it is bounded by a limit the program set: a body by
`http.maxBody` (one MiB by default), a head by the carrier's head cap, the
connections by `slots`.

An answer for a request whose connection has closed,
even one whose slot a new connection has taken since, is dropped and never
reaches the new peer. Once warm, a request allocates nothing. Review
before merge found four faults and fixed each with a test that failed
before the fix (HANDLER-9 to HANDLER-12): a draining connection that kept
reading pipelined requests, a listener that spun the loop when an accept
failed for want of descriptors, length checks that missed bytes still
pending, and `sendJson` sending a value no `json()` began.

A fifth, a body trickled a byte at a time inside the carrier's idle timeout,
holds a slot no longer than `bodyTimeout` (HANDLER-5). None is left open. Three
properties are the program's, by design, and are recorded as accepted: how many
taken requests it holds unanswered (HANDLER-7), what it does with a
parameter or query value (HANDLER-8), and whether its loop runs the steps it
bound before a route body (HANDLER-15).

A body sent with `Content-Encoding: gzip` or `deflate` is decoded before the
program sees it, under its own cap, `maxDecoded` (one MiB by default): a
decompression bomb is answered 413 and never taken, at a cost bounded by
that cap (HANDLER-16). `deflate` means the zlib-wrapped stream only: a raw
deflate body is answered 400. After a decode the request still carries the
`Content-Encoding` and `Content-Length` fields it arrived with; its
`decodedFrom` says which coding was undone. A coding the handler does not
decode reaches the program as sent (HANDLER-17, accepted). `serve()`
(`std/net/serve.ts`, HTTP/1.1) and the `HttpServer` façade
(`std/net/http-server.ts`, every version) have their own loops and do not decode a body: a
gzip body arrives compressed, and their requests have no `decodedFrom`. That
is no bomb risk but leaves the decoding to the program.

## Scope

| File | Functions |
| --- | --- |
| `std/net/handler.ts` | `HandlerLimits` (`listen`); `HttpRequest` (`methodIs`, `pathIs`, `paramStart`, `paramEnd`, `paramIs`, `param`, `paramDecimal`, `checkParam`, `query`, `hasQuery`, `queryIndex`, `header`, `valueStart`, `valueEnd`, `headerIs`); `HttpHandler` (`watch`, `fired`, `wait`, `deferSends`, `flush`, `sends`, `owable`, `settle`, `expireBodies`, `drain`, `acceptAll`, `endAcceptRest`, `drive`, `roomy`, `begin`, `route`, `gather`, `whole`, `decode`, `enqueue`, `resume`, `pushPending`, `finish`, `obtain`, `release`, `releaseReading`, `closeSlot`, `forget`, `sweep`, `ready`, `take`, `before`, `after`, `field`, `live`, `pooled`, `connections`, `resting`, `start`, `write`, `put`, `keep`, `end`, `send`, `sendFields`, `empty`, `json`, `sendJson`, `problem`, `writeProblem`, `writeProblemObject`, `refuse`, `allowFor`); the helpers `handlerAllowAppend`, `handlerWithAdded`, `handlerGrown`, `handlerSpanIs`, `handlerDecimal`, `handlerFormByte`, `handlerFormIs`, `handlerFormDecode` |

Out of scope: the carrier (`std/net/http1-server.ts`, `std/net/http1-codec.ts`;
`docs/security/http1-codec.md`), which has refused a malformed or oversized head,
a bad body framing and a body past the cap before the handler sees a byte of
it; the router (`docs/security/router.md`); and what a program does with a
request once it has taken it. `examples/http-app` is an example, not a
library, and is not in scope.

## Threat model

The attacker is the client: every byte of every request is theirs, they may
open as many connections as the listener accepts, pipeline, send a body
slowly or not at all, and leave at any moment, including while the program
holds their request.

A win is a panic, memory or time a request can make the
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
none is open. HANDLER-16 holds; HANDLER-17 is accepted.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| HANDLER-1 | High if it failed | `gather`, `HandlerLimits` | A body must not grow a request's buffer past the cap, whether its length is declared or it is chunked. | **Holds.** The carrier answers 413 for a declared length over `http.maxBody` and for a chunked body that grows past it, and ends the connection; `gather` only appends what the carrier handed over, so a body buffer is at most the cap, and a handler holds at most `slots` times the cap in bodies. A body exactly at the cap is taken whole. |
| HANDLER-2 | Medium if it failed | `begin` | Copying a head out of the carrier must not read or write past either buffer. | **Holds.** `begin` copies `p.headLength` bytes, and the parser's whole spans array with one `set`, into buffers grown to fit first; the carrier's head and field caps bound both, and only the first `4 * headerCount` spans, this head's, are ever read. Every span a program reads afterwards is into that copy. |
| HANDLER-3 | High if it failed | `live`, `finish`, `closeSlot`, `forget` | An answer for a request whose connection closed — the peer left, the idle timeout passed — must not reach whoever holds the slot now. | **Holds.** Each slot carries a generation, bumped when its connection closes, and a request remembers the one it was read under; an answer for a stale generation answers `HANDLER_DROPPED`, sends nothing and hands the request back to the pool. |
| HANDLER-4 | Medium if it failed | `whole`, `resume`, `pushPending` | Pipelined requests must be answered in order, and a peer that never reads must not make the handler buffer answers without bound. | **Holds.** The carrier reads a connection's next request only once the one before it is answered, and `whole` parks a finished request while more than half an output of the answer before it is unsent (`roomy`), so a connection holds one answer in flight. |
| HANDLER-5 | Medium | `wait`, `expireBodies`, `begin`, `sweep` | A slow or silent peer must not hold a slot past a deadline, nor its request past its connection. The carrier bounds a head (`headTimeout`) and silence (`idleTimeout`) but not a body: its idle timeout restarts on every byte, so a peer that sent a body a byte at a time, each inside `idleTimeout`, held its slot for as long as it liked, and with every slot held new connections were shed. | **Fixed.** `HandlerLimits.bodyTimeout` (30 s by default; 0 or less refused at construction) is a deadline for a whole body, counted from the turn its head was read (`begin` stamps `since`). `wait` checks it at most once a second (`expireBodies`) and closes a connection whose request is still being read past it; `sweep` then releases the request, and one taken is dropped when answered (HANDLER-3). Before the fix "a body trickled inside the idle timeout is cut off at the body deadline" and "with no answer" failed in `tests/link/net_handler`. Three limits remain, by design: the deadline is checked only when `wait` returns, so a program that never calls `wait`, or calls `wait(-1)` with no `idleTimeout`, expires no body while every peer is silent; and closing a slot past the deadline drops whatever an earlier pipelined answer on it has not yet sent. |
| HANDLER-6 | Low if it failed | `queryIndex`, `handlerFormByte`, `handlerFormDecode`, `route` | A malformed escape in the query must not be read past, and HEAD must not reach a route GET does not. | **Holds.** Each escape is checked before it is used; a `%` at the end or with a non-hex digit matches nothing and decodes to `ROUTER_BAD_ESCAPE`, a decoded length past `out` to `ROUTER_NO_ROOM`. A HEAD takes a route only through the router's own match for GET on the same target. |
| HANDLER-7 | Low | `take` | A request the program has taken and not answered stays allocated, even after its connection closes and a new one takes the slot, so a program that never answers grows the pool by one request per connection. | **Accepted.** Answering later is the point of the pull interface; how long the program holds a request is its policy. Answering, even with a dropped result, returns it. `tests/link/net_handler` pins that the pool makes no request past its warm size when every request is answered. |
| HANDLER-8 | Low | `param`, `query` | A decoded parameter or query value may hold `/`, `..`, NUL or any byte. | **Accepted.** As ROUTE-8 and ROUTE-9 record, refusing those is the caller's job; the handler hands the bytes over as ranges and decodes only on request. A query value decodes through `percentDecode` (`docs/security/url.md`) with `URL_DECODE_ALLOW_NUL`, so `%00` is a NUL byte there as it is in a parameter. |
| HANDLER-9 | Medium | `drain`, `begin` | A busy connection kept keep-alive through a drain: once its held request was answered, the carrier read the next pipelined request, so a client that pipelined without end held a draining server open. | **Fixed.** `drain` sets `closeAfter` on each busy connection, and `begin` on each head read while draining: the answer says `Connection: close` and no request behind it is read. Before the fix "a draining connection's answer says it closes" and "and the pipelined request is not read: the connection closes" failed in `tests/link/net_handler`. |
| HANDLER-10 | Medium | `acceptAll`, `wait`, `endAcceptRest`, `forget` | An accept that failed for want of descriptors or memory (EMFILE, ENFILE, ENOMEM) left the connection in the backlog and the listener readable, so every `wait` returned at once: a peer that pushed the process to its descriptor limit made the loop spin a core. | **Fixed.** On any accept error but EAGAIN and ECONNABORTED the listener leaves the loop for 100 ms (`HANDLER_ACCEPT_REST`), and `wait`'s timeout is capped so that it returns. `tests/link/net_handler_descriptors` uses up its own descriptors: "and its turns wait out their timeout rather than spin" failed before the fix, and "once a descriptor is free, the waiting connection is taken" holds. Since WP63 S4 a close ends the rest early: `forget` calls `endAcceptRest`, which clears it and puts the listener back in the loop unless the handler is draining, so a connection waiting in the backlog is taken in the turn that frees its descriptor rather than up to 100 ms later. `tests/link/net_handler_rest_close` holds one connection with no descriptor free, so the second waits and the accept answers -24, then closes the first, counting turns rather than timing them: "and the handler rests its listener on -24" holds, "and the close ends the rest in the same turn" (`resting()` false on the turn the close lands) failed with the close not ending the rest and passes with it, and "and takes the waiting connection in turns that do not wait" follows. A listener `HandlerLimits.ring` opens on io_uring slots answers -23 (ENFILE) when its slot set is full, which takes the same path: the set's listener is not readable while full, so the -23 a burst of accepts ends on is the one the handler sees, and the rest and its early end are what bound the loop. `tests/run.js`'s `net_handler_ring` holds 800 connections against a set of 32-descriptor rings: the handler holds the set's size on slot handles, answers each, must see `resting()` true once the set is full (so it fails if -23 does not rest the listener), and takes a waiting connection into the slot a close frees. The rest is written in three places (the field's 0; `acceptAll` setting it, after it takes the listener out of the loop; `endAcceptRest` clearing it and putting the listener back unless the handler is draining, called from `wait` when the rest has run out and from `forget` when a close lands during one) and read in four (`wait`'s expiry test and timeout cap, `drain`, `forget`, and `resting`, which reports it). |
| HANDLER-11 | Low | `write`, `end` | `write` and `end` checked a declared length against what the carrier had taken, not counting bytes still pending behind a full output, so a program could send more or less body than its `Content-Length` said without the panic the contract promises, and a client would read the excess as the next response. | **Fixed.** Both subtract the pending bytes before comparing. `tests/link/net_handler_overlong` and `net_handler_short` declare 32 MiB, leave half of it pending and overrun or stop short; each printed `FAIL` and exited 0 before the fix and panics now. |
| HANDLER-12 | Low | `json`, `sendJson`, `writeProblem` | `sendJson` with no `json()` before it sent whatever the shared JSON buffer held — another request's answer, perhaps another client's — and a problem too large for the buffer was sent with an empty body. | **Fixed.** `sendJson` panics unless `json()` began its value (`tests/link/net_handler_unbegun`); a problem that does not fit is written without its detail, then without its title ("a problem too large for the JSON buffer is sent without its detail"). |
| HANDLER-13 | Medium if it failed | `deferSends`, `drive`, `owable`, `settle`, `flush`, `wait` | A send put off so a pipelined burst goes out in one write must not be lost, reordered, sent to a later connection on the same slot, or held while the handler blocks; and a request parked for room must not wait on a send nobody makes. | **Holds by reading; no probe since WP49 stage 6** for its burst and reordering paths. Putting a send off is opt-in: only a program that calls `deferSends` gets it (`serve` did until WP49 stage 6, when it took the carrier over with these rules in its own `ServeConns`, SERVE-17), so an explicit `HttpHandler` loop, `upstream` and `postgres-carrier`, which may block on other descriptors, still send each answer as it ends. Then `drive` puts a send off only while the slot has output to send and it is roomy, the handler is not draining and no request on the slot is parked (`owable`); otherwise it settles at once, so a hang-up with nothing to send closes in the pass that reads it. `flush` sends every put-off slot before `wait` polls and before a loop that calls it parks, and skips a slot whose connection has closed (`open`, `holds`). Bytes queued for one connection are never written to the next: closing a slot drops its connection's output with it, and bumps the generation so a later answer for it is dropped. `closeSlot` and `forget` leave the slot's `owing` mark, so if a new connection takes the slot before `flush` runs, `flush` sends that connection's own output a pass early, which is harmless, and clears the mark. A program that calls `deferSends` must call `flush` or `wait` after it answers, or the put-off send waits for the next one (`deferSends`'s and `end`'s doc comments say so). A write the socket could not take whole (`writeHeld`) is not put off (`owable`), and `settle` arms it for write even when a `flush` left its output empty. Its `H1_WRITE` comes only from `next`, so without the arming its pending body was never pushed. The arming is in `settle`, which every handler runs, so it applies to a handler that never calls `deferSends` too, and a held write there can no longer wait on a `next` that does not come. On the merge with `main`, `tests/link/net_handler`'s "once it reads, every answer comes, in order and whole" stalled at 27 of 128 answers before this fix and passes after it. The output is one ordered buffer per connection, so putting the send off changes only when bytes go, never their order. `sendFields` drives the slot once per answer, from `end`, not once after the body and again after the end: the body is in the carrier's output or pending on the request either way (`put`), a write the carrier held back is found by that one `next`, and `net_handler`'s "once it reads, every answer comes, in order and whole" passes unchanged. One result moves: a connection that closes in the pass after the body (the peer reset, or hung up mid-answer) used to make `sendFields` answer `HANDLER_DROPPED`, because `end` then found the slot gone; that pass is now `end`'s own, so the call answers `HANDLER_SENT` and the slot closes inside it, which is what `end` has always answered when its own pass closed the connection. `HANDLER_SENT` never meant delivered, the request is released either way, and a caller has no use for the difference. No counter a program can read tells one pass from two (`sends` counts writes to the socket, one before and one after), so the single pass has no pin of its own: the Ir per request is its measure. `tests/link/net_serve_burst` pinned a 16-request burst answered in order in one write, a 128-answer burst to a peer that reads none answered whole and in order once it reads, and a hang-up mid-burst while `serve` called `deferSends`; since WP49 stage 6 it pins those for `serve`'s own copy of the rules (SERVE-17), so the handler's own put-off send now leans on `tests/link/net_serve_queued_wait` alone, which calls `deferSends` itself; its burst and reordering paths have no handler-level probe left. A parked request that a `flush` lets in is not pinned: `owable` never puts off a slot with a parked request, so `flush` reaches one only when the peer reads between a partial write and the flush, a race a test cannot hold. A loop that calls `flush` loops again rather than park when it happens, as `serve` does. `wait` polls with a zero timeout while a request is queued only on a handler that called `deferSends`, the one case where a `flush` can let a parked request in. A handler that did not call it blocks for its timeout as before, though a request it has not taken waits, so a loop that leaves the queue alone does not spin. `tests/link/net_serve_queued_wait` pins both: without the gate the plain handler's `wait(300)` returned at once, and with it the handler blocks. `drive` stops asking the slot for events while the slot's current request is `HANDLER_STREAMING` with nothing pending on it (`unended`), the same check `HttpServer` makes: the carrier finishes a `Content-Length` response once its last byte is written, so a `next` after that read the request pipelined behind it while the streamed one was still the program's to end (#1556). `tests/link/net_handler_pipelined_stream` writes a five-byte length-framed body, holds the request four turns and ends it late, with `GET /` pipelined in the same write: before the fix "the request pipelined behind it is not taken before its end" counted 1 early take where it pins 0, and "with no pipelined request taken early" counted 121 (the first pair and 120 warm ones) where it pins 0; after it "a warm connection answers a hundred and twenty pairs in order" counts 120 with the request pool flat. The early take did not lose a response in that run, so the drop itself is not observed; the case pins the order that prevents it. While the stream is held a request sent in a later write does not wake `wait` each turn: `wait` reads a readable slot into the carrier's input (`readable`) before `drive`, and the carrier stops asking to read once its input has ended or is full (`inputRoom`); the case's "a request sent behind a held stream does not wake the handler's wait" pins a `wait(300)` that blocks at least 200 ms with one queued. A peer that hangs up while its stream is held leaves the request the program's to end: "a stream held past its peer's hang-up ends as dropped" pins `end` answering `HANDLER_DROPPED`, "with the request pipelined behind it never taken" pins that the pipelined `GET /` is not taken, and the next two checks pin the other connection and the request pool as before; these four were run only with the fix. |
| HANDLER-14 | Medium if it failed | `before`, `after`, `field`, `begin`, `start`, `handlerWithAdded` | A step (WP43 stage 5) must run only for the route `Router.use` bound it to; a step that answers a request must stop the route body and every later step; and a field a step adds must not reach another request's answer, split the head, set a field the carrier reserves (the framing, `Connection`), or grow a request without bound. | **Holds.** `before` loads the route's set from `Router.steps` once, hands out its bits lowest first and records each in `stepsRan`; `after` hands back only those, highest first. Both answer `HANDLER_ANSWERED` as soon as the request is no longer held, and a body that answers it anyway panics in `start` rather than send a second answer. `begin` clears `stepped` and `added` for every head it reads, so neither a set nor a field outlives its request. `field` keeps at most `HANDLER_MAX_ADDED` (16) fields, a seventeenth panics, and `start` hands the added fields to the carrier's `respond` beside the answer's own, in arrays kept per length (`handlerWithAdded`), so they meet the same checks: a reserved name or a name or value that is not a token or field text is `H1_INVALID`, and `start` panics before a byte of the head is written (`tests/link/net_handler_steps_split`, a value holding CR LF). `handlerWithAdded` appends the added fields to the answer's own and checks neither list against the other, so a step's field may repeat a name the answer sets itself, `content-type` on a body or `allow` on a 405, and both go out. It is the class HTTPSRV-16 fixed for the fields `HttpServer` adds itself, but here the repeated name is one the handler's answer sets, and `start` does not look for it: a step that names one of those sends the duplicate; nothing refuses it and no test sends one. The answers the carrier and the handler send themselves, to a malformed or oversized request, a timeout or a full pool, never reach `take`, so they run no step. |
| HANDLER-15 | Low | `before`, `after` | A step runs only when the program's loop calls `before` and acts on what it answers: nothing holds a route body back until its steps have run, so a loop that skips `before`, or runs the body when `before` answered a step id, runs the body unguarded. | **Accepted.** Steps are pulled, as requests are (HANDLER-7), and the loop is the program's. A program that never calls `before` or `after` pays nothing per request for them (`bench/http1-server.ts`, [Steps on a route bound to none](../BENCHMARKS.md#steps-on-a-route-bound-to-none-wp43-s5)). One that does, on a route bound to no step, pays `before`'s state compare, its `stepped` mark, `Router.steps`' bounds compare and mask load and a compare of the mask with 0, and `after`'s state compare and its read of `stepped` and the ran mask: 25.0 to 26.8 instructions a request for the pair, measured on a copy of that bench whose loop calls both. The guide page (`docs/guide/using-nish/api-server.md`, "Steps before and after a route") shows the loop to copy. |
| HANDLER-16 | High if it failed | `whole`, `decode`, `ready`, `HandlerLimits` | A body the carrier took under `http.maxBody` may be gzip or deflate that inflates to gigabytes. Decoding it must not grow memory past a cap the program set, must not hand the program a partial body, and must not cost the connection or the requests behind it. | **Holds.** `decode` runs only for one `Content-Encoding` field naming exactly one of gzip, x-gzip or deflate (`httpContentEncoding`, COMP-18 in `compress.md`), through one `HttpBodyDecoder` per handler whose limit is `maxDecoded`; past it the request is marked 413, and a stream that is not the coding it names, 400. `ready` answers a marked request with a problem and hands it back to the pool before `take` can return it, so the program never sees it, and the connection stays open for the next request. The decoded body takes the decoder's output array and the decoder takes the request's old buffer, so a handler holds at most `slots` times `max(http.maxBody, maxDecoded)` in bodies plus one decoder's output, and while a decode grows that output, the smaller array it replaces (under `maxDecoded`; COMP-18). `maxDecoded` 0 turns decoding off. |
| HANDLER-17 | Low | `decode` | A body with a coding the handler does not decode (`br`, `zstd`, `compress`, two codings, or two `Content-Encoding` fields) reaches the program as sent, with `decodedFrom` `HTTP_CODING_IDENTITY`, though its bytes are not identity. | **Accepted.** Refusing every such body with 415 would take a choice from the program that RFC 9110 §15.5.16 leaves to it, and passing it through decodes nothing, so it costs no more than any other body. The `Content-Encoding` field is still set after the handler decodes a body, so it alone does not tell the two apart: a program that reads a body should answer 415 itself when `decodedFrom` is `HTTP_CODING_IDENTITY` and `httpContentEncoding` on a `Content-Encoding` field gives anything but `HTTP_CODING_IDENTITY` (a field of only `identity` names no coding, so its body is plain); `docs/guide/using-nish/compression.md` says so. |
| HANDLER-18 | Low if it failed | `wait`, `handlerLimitsFault`, `HandlerLimits` | A batched wait (`minEvents` above 1 with `maxWaitMs` above 0, WP63's ring batch) holds a turn open after its first event, so every deadline `wait` enforces, the body deadline (HANDLER-5) and the accept rest (HANDLER-10) among them, is heard that much later, and a turn that must not block must not wait at all. A `maxWaitMs` without a bound would delay them without limit. | **Holds.** `handlerLimitsFault` refuses a `minEvents` under 1 and a `maxWaitMs` over `HANDLER_MAX_WAIT_MS` (1000, the interval `expireBodies` already checks at), and a `maxWaitMs` under 0, which batches nothing and can only be a mistake: `new HttpHandler` panics with the message and `openHttpHandler` answers it as an `Err`. `tests/link/net_handler_batch_limits` opens a handler at each of `minEvents` 0 and -5 and `maxWaitMs` -1 and 1001, and prints the refusal for each; a line of its `expected.out` turns to `opened` and fails without the matching test. `wait` calls `pollWaitBatch` only with both limits set and a `timeout` other than 0, and makes the timeout 0 while a deferred handler holds a queued request; the runtime batches only on a loop a ring source joined, while one ring set is live (`nr_batch` in `runtime/runtime-net.c`). `tests/run.js`'s `net_handler_batch` check ("net_handler: minEvents and maxWaitMs batch a ring wait, and minEvents 1, wait(0), a deferred queue, epoll and two live ring sets do not wait") answers 40 requests at `minEvents` 64, sees a lone pending request held 300 ms or more at `maxWaitMs` 400, and fails if `minEvents` 1 holds it too. At `minEvents` 64 and `maxWaitMs` 400 it then needs every turn under 200 ms while a request arrives, for `wait(0)`, for `wait(3000)` after `deferSends` with a request queued, for a descriptor listener beside a live ring set, and for a ring listener beside a second live set. Each fails at about 400 ms without its guard: `wait(0)` and the deferred queue without `wait`'s `timeout !== 0`, the descriptor listener without `nr_batch`'s check that a ring source joined the loop, and the two sets without its one-set rule. |

**The constructor's limit check is proven where `openHttpHandler` makes the
handler** (#2296). `new HttpHandler` hands its `limits` to
`handlerCheckLimits` (`std/net/handler.ts:942:5`), a fault guard over
`handlerLimitsFault` ([`fault`](../reference/language/semantics-decisions.md#panic-sites)),
so the guard's `panic` (`std/net/handler.ts:2788:5`) is proven and each
construction is a `fault` site of its own. `openHttpHandler` runs
`handlerLimitsFault(limits)` (`std/net/handler.ts:2761:25`) and returns its
`Err` before `new HttpHandler` (`2769:13`); the failed-`pollCreate` return
between them is an `if` that only leaves, so that site is proven.
`tests/link/fault_contract_proven` and `fault_contract_early_exit` are the
same shapes on a two-module program, each pinned by its `expected.panics`,
and each `fault_contract_*` negative stays unproven under `--deny-panics`;
`tests/std-panics.json` counts 7 `panic` sites in `std/net/handler.ts`. A
program that calls `new HttpHandler` itself (`bench/http1-server.ts`,
`bench/handler-ring/server.ts`) still holds an unproven `fault` site. The
constructor no longer panics on a failed `pollCreate`: it makes a dead
handler, whose `wait` answers `HANDLER_NO_LOOP` at once and whose `tryWatch`
answers `Err` (`tests/link/net_handler_dead_loop`, whose `expected.out` reads
`first: 0` and `tryWatch: Ok` without the guards). It builds its body decoder
only through `httpBodyDecoderFault`, so `openHttpHandler` reaches no handler
panic. A program that builds a handler through it builds without
`--allow-panics` as far as the handler goes. The decoder's `tryDecode` calls
the gzip and zlib range decoders (`decompressRange`) on a window it has just
tested, so their checks, and those of `Inflater.inflateAll`, `Crc32.ofRange`
and `adler32Range` under them, are proven at each call: `examples/http-app`
builds without `--allow-panics`. The check "net_static app: examples/http-app
links under --sandbox --allow net,signal,clock,fs.read=<www>" builds it
without the flag, and fails when any of those checks is left unproven.

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

**Order and backpressure** (HANDLER-4): "the first of three pipelined
requests is answered first", "then the second", "then the third"; with 128
answers of 200 KB pipelined, "a peer that pipelines large answers and reads
none is given only what its socket holds", "once it reads, every answer
comes, in order and whole".

**The body deadline** (HANDLER-5): "a body sent whole inside the body
deadline is answered", "a body trickled inside the idle timeout is cut off at
the body deadline", "with no answer", "and its slot is freed".

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

**Steps** (HANDLER-14): lines of `tests/link/net_handler_steps/expected.out`,
which `link/net_handler_steps: exits with 0 and stdout matches expected.out`
compares byte for byte. "its steps run lowest first before the body, the
reverse after"; "GET /admin with no authorization is refused 401", "by AUTH,
so neither the body nor an after-step runs", "and the refusal carries ID's
field", "but not TAG's"; "GET /nope is answered 404", "after the step bound to
ROUTER_NOT_FOUND", "whose field the handler's problem carries"; "POST /plain
is answered 405", "with its Allow and the step's field"; "GET /plain is
answered 200", "and runs no step", "nor carries a field it did not name"; "a
field added to one request is not on the next"; "GET /late is answered 503 by
its after-step", "so the after-step below it does not run", "and the 503
carries ID's field, not the body's answer"; "a warm connection answers
twelve hundred stepped and plain requests", "and the arena stays flat", "and
the pool makes no request past its warm size". A field holding CR LF:
`link/net_handler_steps_split` panics in `start` with "the carrier refused the
head (-22)" and exits 1, on every one of its runs at two pool sizes.

**Decoded bodies** (HANDLER-16, HANDLER-17): lines of
`tests/link/net_handler_bomb/expected.out`, which
`link/net_handler_bomb: exits with 0 and stdout matches expected.out`
compares byte for byte. "a gzip body is taken", "decoded", "to the bytes
that were compressed", "a deflate body is taken", "decoded from the zlib
format", "to the bytes that were compressed, again", "a body decoding to
exactly the cap is taken", "one byte past the cap is answered 413", "and the
program never takes it", "a deflate body decoding to exactly the cap is
taken", "whole, as deflate", "a deflate body one byte past the cap is
answered 413", "and is not taken either"; "the gzip bomb is answered 413", "untaken", "on a connection
that stays open"; "a deflate bomb is answered 413", "the connection serves
the next request", "which the program takes"; "a gzip body with a wrong CRC
is answered 400", "a zlib body cut short is answered 400", "a plain body sent
as gzip is answered 400", "a raw deflate body, no zlib wrapper, is answered
400", "none of them taken"; "an unknown coding is
taken", "two codings in one field are taken", "two codings in two fields are
taken", "as they arrived"; "a warm connection answers forty bodies and forty
bombs", "and the arena stays flat"; "under maxDecoded 0 a deflate body is taken",
"undecoded, with decodedFrom identity".

**Batched waits** (HANDLER-18): every line of
`tests/link/net_handler_batch_limits/expected.out`, which
`link/net_handler_batch_limits: exits with 0 and stdout matches expected.out`
compares byte for byte: "refused 0/1", "refused -5/1", "refused 64/-1" and
"refused 64/1001", each with the message naming both limits, then "opened
1/0" and "opened 64/1000", the bounds themselves. The timing is
`net_handler: minEvents and maxWaitMs batch a ring wait, and minEvents 1,
wait(0), a deferred queue, epoll and two live ring sets do not wait` in
`tests/run.js`, which builds `tests/link/net_handler_batch`, needs io_uring
rings, and is a counted skip where the kernel refuses them. It needs both of
the program's last lines: "batch: 40 answered at minEvents 64, a pending
request held 300+ ms at maxWaitMs 400, and minEvents 1 did not hold it" and
"prompt at minEvents 64: wait(0), a deferred queue, epoll beside a live ring
set, and two live ring sets".
