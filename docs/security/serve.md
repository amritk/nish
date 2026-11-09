# Security record: the async server

The record of WP49 stage 5's serve part: `nish/net/serve`, which runs
`nish/net/handler`'s readiness loop as an `async` function and answers each
request in a task of its own
([wp49-async-server.md](https://github.com/amritk/nish/blob/main/docs/wp49-async-server.md)).
It says what the server holds per connection and per request, what each cap
answers, what a task may reach of the server's memory, and the test that pins
each property. It is written with the code rather than after an audit, so
that the audit of the HTTP application layer starts from evidence.

Anchors are function names in `std/net/serve.ts` at `4375d934`, the last
commit to change it on the head that merges this record.

**Result.** The server adds no parser: the request line, the fields, the
body framing, the head and body caps and the timeouts are the carrier's
(`docs/security/http1-codec.md`), the queueing, ordering and late-answer
rules are the handler's (`docs/security/handler.md`), and routing is the
router's (`docs/security/router.md`). What it adds is a fixed set of request
slots, a copy of each request into its task's region, and a copy of each
answer back into its slot's preallocated buffers. Every one of those is
bounded by a `ServeLimits` field the program set: the slots by `inFlight`,
an answer's body by `responseBytes`, its content type by 128 bytes.

A task never writes past its slot's buffers and never stores its own memory
into the server's: the spawn rule (`docs/LANGUAGE.md`, NL2609, NL2610,
NL2615) refuses the program that would, and the task copies element by
element. A response the program got wrong — a status outside 200 to 599, a
body larger than `responseBytes`, a content type too long or holding a
control byte — is answered 500, never sent as written, and never stops the
server. Review before merge found one fault and fixed it with a test that
failed before the fix (SERVE-5): a content type holding CR or LF reached the
carrier, which refused the head, and the handler panicked, ending the server
for every client.

One property is open: `deadline` is held, not enforced, so a task that never
answers holds its slot (SERVE-8). One is accepted: the server keeps at most
64 distinct content types (SERVE-9).

## Scope

| File | Functions |
| --- | --- |
| `std/net/serve.ts` | `ServeLimits`; `ServeStats`; `Request` (`method`, `path`, `param`, `paramNumber`, `paramMalformed`, `query`, `header`, `text`); `Response` (`text`, `json`, `bytes`); `refuse`; `serve`; `serveOn`; the private `ServeState`, `serveFreeSlot`, `serveAnyBusy`, `serveAnswer`, `serveType`, `serveBytes`, `serveTask`, `serveTick` |

Out of scope: the handler, the carrier and the router, each with its record;
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

## Findings

Rows SERVE-1 to SERVE-4, SERVE-6, SERVE-7 and SERVE-10 are the shapes an
attacker's traffic can take, each checked and found to hold; they are
recorded so that the audit can see what was tried. SERVE-5 was fixed before
merge and is counted as fixed in the index. SERVE-8 is open and counted;
SERVE-9 is accepted.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| SERVE-1 | Medium if it failed | `serveOn`, `serveFreeSlot` | Requests must not make the server spawn tasks or allocate slots without bound. | **Holds.** A slot is made only while fewer than `inFlight` exist; with every slot busy, a whole request is answered 503 (`stats.busy` counts it) and no task is spawned. Slots are reused, never freed, so the server holds at most `inFlight` request copies' worth of response and type buffers. Pinned by "in flight: 503". |
| SERVE-2 | Medium if it failed | `serveOn` (`hl.slots`) | Connections must be bounded. | **Holds.** `connections` is the handler's `slots`; past it the carrier's accept closes the new connection unanswered (`H1_POOL_FULL`). Pinned by "connections: closed". |
| SERVE-3 | Medium if it failed | `serveOn` (`hl.http`) | A header section or body must not grow past its cap. | **Holds.** `headerBytes` and `bodyBytes` are the carrier's `maxHeaderBytes` and `maxBody`; it answers 431 or 413 and ends the connection before the server sees the request (HANDLER-1). Pinned by "header cap: 431" and "body cap: 413". |
| SERVE-4 | Medium if it failed | `serveTask`, `serveAnswer` | A response must not write past its slot's buffers, nor reach the carrier as something it refuses. | **Holds.** The task writes a body only when it fits `responseBytes` and a type only when it fits 128 bytes, else it marks the slot -1; `serveAnswer` answers 500 for a marked slot and for a status outside 200 to 599, and counts `stats.failed`. Pinned by "response cap: 500" and "bad status: 500". |
| SERVE-5 | Medium | `serveType` | A content type holding CR, LF or another control byte made the carrier refuse the head, and `HttpHandler.start` panicked on the refusal, so a peer whose input reached the type stopped the server. | **Fixed.** `serveType` refuses a type with a byte under 32 other than tab, or 127 — the carrier's field-text rule — so the request is answered 500. Before: `link/net_serve` panicked with "the carrier refused the head (-22)" and exited 1 after "bad status"; after: "bad type: 500". |
| SERVE-6 | High if it failed | `serveOn`, `serveTask` | Pipelined answers must go out in request order, and one task must never read or write another request's memory. | **Holds.** The handler reads a connection's next request only once the one before it is answered (HANDLER-4), so one connection has at most one slot. A task reads only its slot `k`'s request, copied into its own region before `handle` runs, and writes only slot `k`'s buffers; a slot is reused only after the loop sent its answer. Pinned by "pipelined 1: ... slept 60" before "pipelined 2: ... slept 1", and by 4000 pipelined answers checked in order. |
| SERVE-7 | Medium if it failed | `serveTask`, `serveOn` | The server's memory must not grow per request. | **Holds.** A task's allocations — the request copy, the `Request` and `Response`, `handle`'s own — live in its region and go when it ends; the loop allocates no per-request object once its slots and type cache are warm. `Arena.used()` in the server's loop is 48 bytes after 100 requests and 48 after 4000 (also 48/48 at 200, 1000 and 8000). Pinned by "arena flat: true". |
| SERVE-8 | Low | `ServeLimits.deadline` | A task that never answers — a `handle` waiting on something that never comes — holds its slot, and with `inFlight` of them the server answers every new request 503. | **Open.** `deadline` is held for the cancellation stage, which cancels a task past it; until then the bound is `inFlight` and the program's `handle`. The carrier's timeouts still end an idle or slow peer's connection, and its late answer is dropped (SERVE-10). |
| SERVE-9 | Low | `serveType` | The server keeps the bytes of at most 64 distinct content types; a 65th is answered 500. | **Accepted.** The cache is what keeps a warm server from allocating per answer. A program that echoes a peer's text into the type lets the peer fill it; a type is the program's choice, and 64 covers any fixed set. |
| SERVE-10 | High if it failed | `serveAnswer` | An answer for a request whose connection closed while its task ran must not reach whoever holds the connection's slot now. | **Holds.** The loop answers through the handler, which drops an answer for a closed connection even after a new one took the slot (HANDLER-3); the server's slot is freed either way. |

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
"bad type: 500", and "serve: 0, answered 13, busy 1, failed 3, slots 1" — the
server answered every request and stopped cleanly.

**Order** (SERVE-6): "pipelined 1: 200 [text/plain; charset=utf-8] slept 60"
then "pipelined 2: 200 [text/plain; charset=utf-8] slept 1"; "client: 4000
answered in order, 0 not".

**Flat memory** (SERVE-7): "arena flat: true", with "serve: 0, answered 4000,
failed 0, slots 1".

## Tests

- `tests/link/net_serve`
- `tests/link/net_serve_pipelined_flat`
