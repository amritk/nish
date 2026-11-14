# Security record: the async server

The record of `nish/net/serve`, which drives `nish/net/http1-server`'s
connections from a readiness loop that is an `async` function, and answers
each request in a task of its own.
It says what the server holds per connection and per request, what each cap
answers, what a task may reach of the server's memory, and the test that pins
each property. It is written with the code rather than after an audit, so
that the audit of the HTTP application layer starts from evidence.

Anchors are function names in `std/net/serve.ts`.

**Result.** The server adds no parser: the request line, the fields, the
body framing, the head and body caps and the timeouts are the carrier's
(`docs/security/http1-codec.md`), and routing is the router's
(`docs/security/router.md`). The queueing, ordering and late-answer rules
are `nish/net/handler`'s (`docs/security/handler.md`), carried into the
server's own `ServeConns` rule for rule when WP49 stage 6 had it drive the
carrier itself (SERVE-17). What it adds is a fixed set of request slots, a
copy of each request into its task's region, and a copy of each answer back
into its slot's preallocated buffers. Every one of those is
bounded by a `ServeLimits` field the program set: the slots by `inFlight`,
an answer's body by `responseBytes`, its content type by 128 bytes. Why the
request is a copy, and how long each side of it lives, is
[the request's lifetime](#the-requests-lifetime) below.

A task never writes past its slot's buffers and never stores its own memory
into the server's: the spawn rule (`docs/LANGUAGE.md`, NL2609, NL2610,
NL2615) refuses the program that would. The task copies the request's head (only
its `headLength` bytes), its spans (only `4 × headerCount` of them) and its
parameters and body (when it has any) into arrays of its own (a copy out
of the server's memory, which the rule allows) and its answer into its
slot's buffer with `set`, which stores bytes, never a pointer. A response the program got wrong — a status outside 200 to 599, a
body larger than `responseBytes`, a content type too long or holding a
control byte — is answered 500, never sent as written, and never stops the
server. Review before merge found one fault and fixed it with a test that
failed before the fix (SERVE-5): a content type holding CR or LF reached the
carrier, which refused the head, and the loop panicked, ending the server
for every client.

A task that never answered held its slot, and kept the server's drain from
finishing, until the cancellation stage of WP49 (SERVE-8): the server now
cancels a task whose client hung up, a task past `deadline`, and every task
still running when it stops. One is accepted: the server keeps at most
64 distinct content types (SERVE-9).

## Scope

| File | Functions |
| --- | --- |
| `std/net/serve.ts` | `ServeLimits`; `ServeStats`; `Request` (`method`, `path`, `param`, `paramNumber`, `paramMalformed`, `query`, `header`, `text`); `Response` (`text`, `json`, `bytes`); `refuse`; `serve`; `serveOn`; the private `ServeState`, `serveFreeSlot`, `serveAnyBusy`, `serveAnswer`, `serveFields`, `serveType`, `serveBytes`, `serveTask`, `serveTick`; `ServeStats.sends`; the private `ServeConns` (`turn`, `drain`, `acceptAll`, `flush`, `drive`, `settle`, `roomy`, `begin`, `enqueue`, `ready`, `take`, `live`, `hungUp`, `closeSlot`, `forget`, `send`, `finish`, `refuse`, `problem`, `allowFor`), `serveProblem`, `serveSpanIs`, `serveAllowAppend`, `serveGrown` |

Out of scope: the carrier, the router and `HttpRequest` (the handler's
record), each with its record;
the executor and the spawn rule (`docs/security/async.md`); and what a
program's `handle` does with a request.

## Threat model

The attacker is the client: every byte of every request is theirs, they may
open as many connections as the listener accepts, pipeline, send slowly or
not at all, and leave at any moment, including while a task holds their
request.

A win is a panic or a stopped server, memory or time a request can make the
server spend beyond the limits the program set, one peer receiving an answer
meant for another, an answer sent out of request order on one connection, or
a task reading or writing another request's memory. The program, its
`ServeLimits` and its `handle` are trusted; but `handle` builds its response
from the request, so a response field the peer can shape (a content type
echoed from a header, a body sized by the request) is treated as the peer's.

## The request's lifetime

A task reads a copy of its request, never the slot's own. The language
refuses a task that keeps the slot's request (a `Request` over it is "memory
outside a region kept by the region's memory"), so the copy is the rule the
code is built to:

1. **A slot's request is read in place, and is the server's.** Each
   connection slot has one `HttpRequest`, built on the slot's first connection and
   reused for every exchange on the slot. `ServeConns.begin` points its head
   and spans at the carrier's parser's own arrays rather than copying them,
   routes it and records the head's offsets; the body is gathered into the
   slot's own array, grown to the largest body the slot has read, at most
   `bodyBytes`. The parser keeps that head until the exchange's answer is
   sent: it reads a connection's next request only once the one before it
   is answered (SERVE-6), so nothing rewrites the head while a task copies
   it.
2. **The task copies it first, with no await before the copy.** `spawn`
   runs a task to its first await at once, and `serveTask` has none before
   it allocates a `HttpRequest` in its own region and copies `headLength`
   bytes of head, `4 × headerCount` spans, the parameters and the body. The
   copy reads the server's memory and stores none of it, which the spawn
   rule allows. Each count is one the server bounded: the head by the
   carrier's head cap, the body by `bodyBytes`.
3. **`Request` and `Request.raw` are the task's, and go when it ends.** A
   handler may keep neither: the spawn rule refuses a program that stores one
   in anything the task shares (NL2609; the guide's `stats.last = req`). What
   the handler made from the request — a string, a number — is its own on the
   same terms. A hang-up or a deadline that cancels a task leaves its copy
   readable until the task ends, even once the slot has closed and taken
   the next connection (SERVE-17).
4. **The server reads only the slot's request again.** `serveAnswer`
   answers through the slot and generation the loop took, never through
   anything the task made; the generation is what drops an answer for a
   connection that closed meanwhile (SERVE-10).

A `Request` the server made once per slot and handed to `handle` is refused
for any handler that "may grow it": one that writes through its argument
and allocates, which `HttpRequest.queryIndex`'s two scratch fields make true
of every handler that reads a query parameter. Lifting that is a change to
the region rules in `src/`, not to this module.

## Findings

Rows SERVE-1 to SERVE-4, SERVE-6, SERVE-7 and SERVE-10 are the shapes an
attacker's traffic can take, each checked and found to hold; they are
recorded so that the audit can see what was tried. SERVE-5 was fixed before
merge and SERVE-8 by the cancellation stage; both are counted as fixed in the
index. SERVE-14 is open and counted; SERVE-9 and SERVE-11 to SERVE-13 are accepted. SERVE-11 to SERVE-14
are what one client's connections, rather than its requests, can hold: each is
bounded by a `ServeLimits` field, and none by the peer. SERVE-15 holds and is
not counted: the field it guards is the program's, not the peer's. SERVE-16 and SERVE-17 hold
and are recorded because the loop changed under them.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| SERVE-1 | Medium if it failed | `serveOn`, `serveFreeSlot` | Requests must not make the server spawn tasks or allocate slots without bound. | **Holds.** A slot is made only while fewer than `inFlight` exist; with every slot busy, a whole request is answered 503 (`stats.busy` counts it) and no task is spawned. Slots are reused, never freed, so the server holds at most `inFlight` request copies' worth of response and type buffers. Pinned by "in flight: 503". |
| SERVE-2 | Medium if it failed | `ServeConns` (`slots`) | Connections must be bounded. | **Holds.** `connections` is the carrier's pool size; past it the carrier's accept closes the new connection unanswered (`H1_POOL_FULL`). Pinned by "connections: closed". |
| SERVE-3 | Medium if it failed | `ServeConns` (`Http1Config`) | A header section or body must not grow past its cap. | **Holds.** `headerBytes` and `bodyBytes` are the carrier's `maxHeaderBytes` and `maxBody`; it answers 431 or 413 and ends the connection before the server sees the request (HANDLER-1). Pinned by "header cap: 431" and "body cap: 413". |
| SERVE-4 | Medium if it failed | `serveTask`, `serveAnswer` | A response must not write past its slot's buffers, nor reach the carrier as something it refuses. | **Holds.** The task writes a body only when its `length` is neither negative nor past `responseBytes` or the body it names, and a type only when it fits 128 bytes, else it marks the slot -1; `serveAnswer` answers 500 for a marked slot and for a status outside 200 to 599, and counts `stats.failed`. A body the slot holds is copied whole with one `set` (`set` refuses a source longer than its target), and only `length` bytes of it are sent; a body wider than the slot is copied byte by byte up to `length`. Pinned by "response cap: 500", "bad status: 500", "negative length: 500", "length past the body: 500", "body past its length" and "body past the slot". |
| SERVE-5 | Medium | `serveType` | A content type holding CR, LF or another control byte made the carrier refuse the head, and `HttpHandler.start` panicked on the refusal, so a peer whose input reached the type stopped the server. | **Fixed.** `serveType` refuses a type with a byte under 32 other than tab, or 127 — the carrier's field-text rule — so the request is answered 500. Before: `link/net_serve` panicked with "the carrier refused the head (-22)" and exited 1 after "bad status"; after: "bad type: 500". |
| SERVE-6 | High if it failed | `serveOn`, `serveTask` | Pipelined answers must go out in request order, and one task must never read or write another request's memory. | **Holds.** The carrier reads a connection's next request only once the one before it is answered (HANDLER-4's rule, kept by `ServeConns.drive`), so one connection has at most one slot. A task reads only its slot `k`'s request, copied into its own region before `handle` runs, and writes only slot `k`'s buffers; a slot is reused only after the loop sent its answer. Pinned by "pipelined 1: ... slept 60" before "pipelined 2: ... slept 1" — the second request is read only once the first, slower one is answered, so this pins serial order on a connection, not a reordering of tasks that finish out of order — and by 4000 pipelined answers checked in order. |
| SERVE-7 | Medium if it failed | `serveTask`, `serveOn` | The server's memory must not grow per request. | **Holds.** A task's allocations — the request copy, the `Request` and `Response`, `handle`'s own — live in its region and go when it ends; the loop allocates no per-request object in the arena once its slots and type cache are warm. What the runtime allocates outside the arena for a task's frame and region is not measured here. `Arena.used()` in the server's loop is 48 bytes after 100 requests and 48 after 4000 (also 48/48 at 200, 1000 and 8000). Pinned by "arena flat: true"; peak RSS by `tests/link/net_serve_rss_flat`, whose 256 KiB band over 4500 requests bounds a per-request leak to under about 58 bytes (Linux only). |
| SERVE-8 | Low | `ServeLimits.deadline` | A task that never answers — a `handle` waiting on something that never comes — holds its slot, and with `inFlight` of them the server answers every new request 503. | **Fixed** by the cancellation stage of WP49. Each task arms `cancelAfter(taskId(), deadline)` as it starts; the server's loop cancels a busy slot's task once its connection hung up (`ServeConns.hungUp`: the slot's generation moved on, or the carrier's `Http1Connection.ended()`); and when the server stops it cancels every task still running, and each that starts later. A cancelled task's awaits answer false at once (`nish:async`'s `cancel`, ASYNC-6 in `async.md`), so `handle` runs on to its end, its slot is freed and the drain finishes; its answer, if its connection is gone, is dropped (SERVE-10). Before: a task parked on `sleep(10000)` held its slot for the 10 s, and `serve` with `maxRequests` reached returned only after it: "serve: 0, answered 2, returned within 2 s: false" (`link/net_serve_shutdown` with the stop's cancel taken out, 10.0 s). After: "returned within 2 s: true", and the task logs "slow: the sleep answered false, cancelled true"; `link/net_serve_hangup` ("after the await: it answered false, cancelled true") and `link/net_serve_deadline` ("slow: 503 ... past the deadline", "slow answered within 2 s: true"). What stays open is a `handle` that does not await: a loop that never yields cannot be cancelled, and holds the executor itself (ASYNC-5 in `async.md`). |
| SERVE-9 | Low | `serveType` | The server keeps the bytes of at most 64 distinct content types; a 65th is answered 500. | **Accepted.** The cache is what keeps a warm server from allocating per answer. A program that echoes a peer's text into the type lets the peer fill it; a type is the program's choice, and 64 covers any fixed set. |
| SERVE-10 | High if it failed | `serveAnswer` | An answer for a request whose connection closed while its task ran must not reach whoever holds the connection's slot now. | **Holds.** `ServeConns.send` and `refuse` answer only while the slot holds the connection at the generation the loop took (`live`), so an answer for a closed connection is dropped even after a new one took the slot, as the handler's was (HANDLER-3); the server's slot is freed either way. Pinned by "after a hang-up: 200 [text/plain; charset=utf-8] hello": a client hangs up while its task sleeps 80 ms, and with the next connection the late "slept 80" is not what it reads, and the slot is free again for it. |
| SERVE-11 | Low | `ServeLimits.headTimeout`, `ServeConns` (`Http1Config`) | A client that trickles its request head (slowloris) holds a connection while it does, and with `connections` such clients every new connection is closed unanswered. | **Accepted.** `headTimeout` (30 s by default) is the carrier's deadline for a whole head, counted from its first byte however steadily the bytes come (H1-1 in `http1-codec.md`); past it the connection is closed. A body trickled after its head is bounded the same way: once a second `ServeConns.turn` closes a connection still reading a body 30 s after its head, as the handler's `bodyTimeout` did (HANDLER-5). A program facing such clients lowers `headTimeout`; what neither bounds is how many connections one peer opens, which is the network's to cap. |
| SERVE-12 | Low | `ServeLimits.idleTimeout`, `ServeConns` (`Http1Config`) | A keep-alive connection that sends nothing more holds its connection slot until it is closed, so idle clients can take every slot. | **Accepted.** `idleTimeout` (60 s by default) is the carrier's: a connection with no byte read or written for that long is closed and its slot freed. A program that wants slots back sooner lowers it; keep-alive is what spares a client a new handshake per request. |
| SERVE-13 | Low | `ServeLimits` | The server's worst-case memory must be known from its caps. | **Accepted, stated.** From the caps, not measured: each connection holds the carrier's input and head buffers (each about `headerBytes`), a 64 KiB output buffer while it writes, and its slot's request (built on the slot's first connection), whose head is the parser's and whose body is up to `bodyBytes`; each in-flight request holds its copy in its task's region (the same size again) and its slot's `responseBytes` + 128 bytes, kept for reuse. So about `connections` × (`bodyBytes` + 2 × `headerBytes` + 64 KiB) + `inFlight` × (`bodyBytes` + `headerBytes` + `responseBytes` + 128) bytes: with the defaults about 256 × 1.09 MiB + 256 × 1.08 MiB, some 555 MiB, almost all of it two copies of a 1 MiB body per connection. A program sizes it by `bodyBytes`, `connections` and `inFlight`. Measured: reading in place moved peak RSS at TechEmpower plaintext with 16384 connections from 26.2 to 32.5 MiB (+24%), since each connection's slot now keeps its request; it stays bounded by `connections`, and `tests/link/net_serve_rss_flat` pins that it does not grow with the request count. |
| SERVE-14 | Low | `serveOn`, `serveFreeSlot` | One client can take every in-flight slot: a connection holds at most one (HANDLER-4), but with `inFlight` connections, each sending a request its `handle` is slow to answer, every other client's request is answered 503 until those tasks end. | **Open.** The server has no per-peer share of `inFlight` or `connections`; the bound is `deadline` (SERVE-8), 30 s by default, and a client's hang-up ends its own task at once. A program behind a proxy that caps connections per address is not exposed. |
| SERVE-15 | Low | `ServeLimits.server`, `serveFields`, `serveAnswer` | The `server` field the server writes into every answer's head must not let its value add a field or end the head, and must not cost work per request. | **Holds.** The value is the program's, never the peer's. `serveFields` makes its bytes once, as `serveOn` starts, and panics there on a byte under 32 or 127, so CR and LF never reach the carrier and a bad value stops the program before it listens; `serveAnswer` passes the same arrays to every answer, setting only the content type in place. The answers the server and the carrier write themselves (`refuse`, `problem`: 404, 405, 400, 413, 431, 500, 503) carry no `server` field. Pinned by `tests/link/net_serve_server_field`: "named /text: … server=nish", "named /empty: 204 [] \| server=nish", "named /nope: 404 … server=(none)" and the "unnamed" lines' "server=(none)"; the panic by `tests/link/net_serve_server_panic`, which exits 1 before it listens. |
| SERVE-16 | Medium if it failed | `serve`, `serveTask` | Taking several queued requests per turn and sending a pipelined burst in one write must keep the answers in order, must not hold answers while the loop parks, must not buffer without bound for a peer that reads none, and must keep a hang-up cancelling the task it strands. | **Holds.** The carrier still reads a connection's next request only once the one before it is answered, so the tasks a turn spawns are one per connection; the turn ends with `ServeConns.flush` before it parks, and loops again rather than park while a send has let a parked request in. Backpressure and the hang-up path follow the handler's rules (HANDLER-4, HANDLER-13), now in `ServeConns` (SERVE-17). `tests/link/net_serve_burst` pins "burst of 16: 16 answered in order", "burst of 16: 1 write(s)", "big burst: 128 of 128 answered whole and in order" and "the parked task: its await answered false, cancelled true". |
| SERVE-17 | High if it failed | `ServeConns`, `serveTask` | Driving the carrier directly instead of through `HttpHandler` (WP49 stage 6) must keep each of the handler's rules the server relied on, and the request read in place must stay its own exchange's for as long as anything reads it. | **Holds.** `ServeConns` keeps the handler's rules one for one: the late-answer drop by slot and generation (HANDLER-3, `live`); one exchange per connection, parked while the output is more than half full (HANDLER-4, `drive`, `roomy`, `settle`); the 30 s body deadline, swept once a second (HANDLER-5, `turn`); HEAD reaching only a route GET reaches (HANDLER-6, `begin`); `Connection: close` on each head read while draining (HANDLER-9, `begin`); a 100 ms rest for the listener after an accept fails for want of descriptors or memory (HANDLER-10, `acceptAll`); a body written once at the length the head declared, with what the output cannot take pending on the slot (HANDLER-11, `send`, `finish`); fixed problem bodies made once (HANDLER-12); and the put-off send flushed before the loop parks, never to a later connection on the slot (HANDLER-13, `drive`, `flush`). An answer whose head cannot fit behind the output closes its connection (`H1_AGAIN`), as the handler's did; that close has no probe and is recorded untested here. What changed is the request: its head and spans are the parser's, not a copy, which holds because the parser keeps them until the answer is sent and the task copies them before its first await ([the request's lifetime](#the-requests-lifetime)); a task that kept the slot's request instead is refused by the spawn rule ("memory outside a region kept by the region's memory"), which the checker enforces: its negative test is `tests/cases/reject_async_spawn_handler_keep` (NL2609, "stores `req` into `board.last`"), and there is no serve-specific negative. What the probes pin, rule by rule: HEAD and the draining close by `tests/link/net_serve_head_drain`, "HEAD /page: 200 length=11 connection=", "HEAD /form: 405 length=64 connection= allow=POST" and, with the fourth answer starting the drain, "draining, the slow answer: 200 length=4 connection=close" and "the pipelined GET unanswered: true" (with HEAD's mapping taken out HEAD /page answers 405, and with `drain`'s `closeAfter` taken out the pipelined GET is answered); the put-off send and backpressure by `tests/link/net_serve_burst` (SERVE-16), whose "big burst: 128 of 128 answered whole and in order" also drives the pending-body path of HANDLER-11; a steady peak RSS by `tests/link/net_serve_rss_flat` ("peak RSS after 5000 requests within 256 KiB of after 500: true"; a per-request leak put in moved it from 3224 to 5060 KiB; the 256 KiB band over the 4500 requests after the warm-up catches a leak of about 58 bytes per request or more, and only on Linux); the fixed problem bodies (HANDLER-12) by `tests/link/net_serve`'s 404, 405, 500 and 503 lines; the late-answer drop (HANDLER-3) through SERVE-10, by `net_serve`'s "after a hang-up" and `net_serve_burst`'s "the parked task". The rest have no serve-level probe and are recorded as untested here: the 100 ms accept rest (HANDLER-10), since `serve`'s loop exposes no turn count and a spin shows only as CPU (the handler's own is pinned by `net_handler_descriptors`); a declared length that disagrees with the body (HANDLER-11), which cannot arise, since `serve` writes the length it computes from the task's own body; and the 30 s body deadline, which needs 30 s. `tests/link/net_serve_slot_reuse` pins, with one connection slot, that a task cancelled by its client's hang-up reads "POST /first tag=one body=alpha" after its await and that the next connection on that slot is answered with its own "bravo!". It does not prove the copy: the copy is forced by the spawn rule above, and a stale read is unreachable, because the loop cancels a hung-up task in the turn its slot closes and reads a new connection's bytes only in a later turn. |

## Properties verified

Each property below is pinned by a line of
`tests/link/net_serve/expected.out` or
`tests/link/net_serve_pipelined_flat/expected.out`, which
`link/net_serve: exits with 0 and stdout matches expected.out` and
`link/net_serve_pipelined_flat: exits with 0 and stdout matches expected.out`
compare byte for byte. Both programs serve over loopback, with the client a
task of the same program.

**The caps** (SERVE-1 to SERVE-3): "header cap: 431 []", "body cap: 413 []",
"in flight: 503", "connections: closed".

**Bad responses** (SERVE-4, SERVE-5): "response cap: 500", "bad status: 500",
"bad type: 500", "no content type: 200 [] xxx" (a body with an empty type goes out with no `Content-Type`), and "serve: 0, answered 17, busy 1, failed 4, slots 1" — the
server answered every request and stopped cleanly.

**A hang-up** (SERVE-10): "after a hang-up: 200 [text/plain; charset=utf-8]
hello".

**Order** (SERVE-6): "pipelined 1: 200 [text/plain; charset=utf-8] slept 60"
then "pipelined 2: 200 [text/plain; charset=utf-8] slept 1"; "client: 4000
answered in order, 0 not".

**Flat memory** (SERVE-7): "arena flat: true", with "serve: 0, answered 4000,
failed 0, slots 1".

**Cancellation** (SERVE-8), each in its own program: a hang-up,
`tests/link/net_serve_hangup` — "after the await: it answered false, cancelled
true", "a later await: it answered false; the task ends", "arena flat: true";
the deadline, `tests/link/net_serve_deadline` — "slow: 503
[text/plain; charset=utf-8] past the deadline", "slow answered within 2 s:
true", and the connection serves the next request; and the stop,
`tests/link/net_serve_shutdown` — "slow: the sleep answered false, cancelled
true", "serve: 0, answered 2, returned within 2 s: true".

**Pipelined bursts** (SERVE-16): `tests/link/net_serve_burst` — "burst of 16:
16 answered in order", "burst of 16: 1 write(s)", "big burst: fewer than 128
answered while unread: true", "big burst: 128 of 128 answered whole and in
order", "the parked task: its await answered false, cancelled true", "after
the hang-up: 4 answered on that connection".

**A request read in place** (SERVE-17): `tests/link/net_serve_slot_reuse` —
"first, after its await (answered false, cancelled true): POST /first
tag=one body=alpha", "second: PUT /second/x tag=two body=bravo!", "the
second client read: 200 [text/plain; charset=utf-8] bravo!".

**HEAD and the draining close** (SERVE-17): `tests/link/net_serve_head_drain`
— "HEAD /page: 200 length=11 connection=", "HEAD /form: 405 length=64
connection= allow=POST", "draining, the slow answer: 200 length=4
connection=close", "then the connection closes: true, after the body
\"slow\", the pipelined GET unanswered: true".

**A steady peak RSS** (SERVE-13, SERVE-17): `tests/link/net_serve_rss_flat` —
"client: 5000 answered, 0 round(s) wrong", "peak RSS after 5000 requests
within 256 KiB of after 500: true" (Linux; read from `VmHWM`).

## Tests

- `tests/link/net_serve`
- `tests/link/net_serve_pipelined_flat`
- `tests/link/net_serve_hangup`, `tests/link/net_serve_deadline`,
  `tests/link/net_serve_shutdown` (SERVE-8)
- `tests/link/net_serve_server_field` (SERVE-15)
- `tests/link/net_serve_server_panic` (SERVE-15)
- `tests/link/net_serve_burst` (SERVE-16)
- `tests/link/net_serve_slot_reuse` (SERVE-17)
- `tests/link/net_serve_head_drain` (SERVE-17)
- `tests/link/net_serve_rss_flat` (SERVE-13, SERVE-17)
