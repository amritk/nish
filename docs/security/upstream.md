# Security record: upstream HTTP calls

The record of `nish/net/upstream`, the outbound HTTP/1.1 calls a route handler
makes without blocking its worker
([wp49-async-server.md](../wp49-async-server.md) §7). It says what a call
holds, what the origin can make the pool spend, how an answer reaches the
request that asked for it and no other, where the outbound policy is checked,
and the test that pins each property. It is written with the code, at base
commit `924e0ee`, rather than after an audit. It names functions rather than
lines, so it holds at any commit that has them.

**Result.** The module adds no parser: a response's status line, fields,
framing and body are read by the `nish/net/http1-client` codec
([http-client.md](http-client.md)) under caps the program sets once, and every
refusal of the codec ends the call that was reading, as a failure with the
codec's code. What the module adds is bookkeeping — a fixed pool of call slots
and connections on the handler's poll loop — and each piece of it is bounded:
the slots by `calls`, the connections by `connections`, a request head by
`maxHead`, a body by `maxBody`, a call's time by `timeoutMs`. A connection
whose call ended any way but whole is closed, so no byte a failed, late or
over-long response left behind is read as the next call's answer, and a
kept-alive connection is read once more before it is reused, so one the
origin closed or wrote to while it sat idle is closed instead. Under an
`OutboundPolicy` the origin's host name is checked before the lookup and its
addresses after it, and the pool connects only to the bytes that were checked,
with no second lookup. Four faults were found and fixed, each with a test.
Writing the record found one: the codec allocated each response's field names
and values as strings, so the arena grew with every call (UPSTREAM-8, Medium).
It is fixed in the codec, which now records a response's fields as spans of a
head buffer it reuses, and the pool keeps one codec per connection. Review
before merge found the other three: a second `release` (UPSTREAM-7), a reset
read as the end of a close-delimited body (UPSTREAM-12) and a kept-alive
connection reused without a look at what the origin did to it while idle
(UPSTREAM-13). Four properties are limits by design, recorded as accepted
(UPSTREAM-9 to UPSTREAM-11, UPSTREAM-14).

## Scope

| File | Functions |
| --- | --- |
| `std/net/upstream.ts` | `UpstreamLimits`; `UpstreamResponse`; `Upstream` (`settle`, `fail`, `get`, `ready`, `take`, `release`, `pending`, `openConnections`, `pump`, `dispatch`, `idle`, `usable`, `connect`, `service`, `send`, `receive`, `parse`, `finish`, `end`, `interest`, `close`); `UpstreamConnection`; the helpers `upstreamParser`, `upstreamAppend` |

The codec's spans mode, added for UPSTREAM-8, is
[http1-client.md](http1-client.md)'s to review, with the rest of the codec.

Out of scope: the response codec, its spans mode included, and `http1WriteRequestHead`
(`std/net/http1-client.ts`, [http-client.md](http-client.md)); the outbound
policy's address and host checks (`std/net/outbound.ts`,
[outbound.md](outbound.md)), which this module calls; the stub resolver
(`std/net/dns.ts`, [dns.md](dns.md)); the URL parser (`std/net/url.ts`,
[url.md](url.md)); and the handler whose loop and requests the pool uses
(`std/net/handler.ts`, [handler.md](handler.md)).

## Threat model

The attacker is the origin, or whoever is on the path to it: every byte of
every response is theirs, they may answer slowly, never, out of turn, with
more than one response, or close at any moment. When the origin itself comes
from input (configuration, an environment variable, a request), the attacker
also chooses it, and may point it at a private address or a name that
resolves to one. A win is a panic, memory or time a call can make the program
spend beyond the limits it set, a stalled loop, one request receiving an
answer meant for another, or a connection to an address the policy refuses.
The program and its `UpstreamLimits` are trusted; misuse of the call API
(`take` with nothing ready, a second `release`) panics, since an origin cannot
cause it.

**Two `Upstream`s on one handler must be given watch ids that do not
overlap.** Each takes `connections` ids from `firstId` up, and the handler
wakes an id, not a socket: nothing checks that two pools' ranges are apart,
and two made with the default limits both take ids 8 to 11, so each reads the
other's wake-ups as its own. The program gives each pool its own range.

## Findings

Rows UPSTREAM-1 to UPSTREAM-6 are the shapes an attacker's traffic can take,
each checked and found to hold. UPSTREAM-7, UPSTREAM-8, UPSTREAM-12 and
UPSTREAM-13 were fixed before merge and are counted as fixed in the index;
UPSTREAM-9 to UPSTREAM-11 and UPSTREAM-14 are accepted and not counted. The
table is in id order.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| UPSTREAM-1 | High if it failed | `parse`, `upstreamAppend`, `upstreamParser` | A response must not grow a call's buffers past the caps, nor be taken as whole when the codec refused it. | **Holds.** Each connection's codec is made with `maxStatusLine`, `maxHeaderBytes`, `maxHeaders`, `maxBody` and `maxTrailerBytes`; `upstreamAppend` only appends what the codec handed over, and grows by doubling, so a body buffer is under twice the largest body it has held, and at least 1 KiB. `upstreamParser` clamps `maxBody` to 1 GiB, so that doubling stays inside an i32 index. Every `HTTP1_ERROR` ends the call with the codec's code, `ok === false` and `length === 0`. |
| UPSTREAM-2 | High if it failed | `finish`, `close`, `parse`, `receive`, `usable` | An answer must reach the request that asked and no other: a late, malformed or extra response must not be read as the next call's. | **Holds.** A call's slot carries its `req` from `get` to `take`. A connection whose call ended any way but whole is closed (`finish`), so a response that arrives after its call timed out goes nowhere. A connection is kept only when the codec says keep-alive and holds no byte past the response (`buffered() === 0`). Before an idle connection carries a call it is read once (`usable`): a byte or a close there closes it, and the call takes another connection (UPSTREAM-13). |
| UPSTREAM-3 | High if it failed | `get`, `connect`, `send`, `receive`, `pump` | A slow or silent origin must not stall the handler's loop or another client. | **Holds.** Connects, writes and reads are non-blocking and run only when the poll says the socket is ready; `get` writes into its slot and returns. Each call has a deadline, `timeoutMs` after `get`, checked on connections and on calls still queued; past it the call ends `UPSTREAM_E_TIMEOUT` and its connection closes. |
| UPSTREAM-4 | High if it failed | `settle` | Under a policy, the pool must not connect to an address it refuses, including through a name that resolves to one or a second lookup that answers differently. | **Holds.** `outboundHostAllowed` checks the name before the lookup; `outboundFilter` drops every refused address from the one answer; the first address left is copied and is the only one ever connected to. A refused origin connects nothing, and every call fails `UPSTREAM_E_BLOCKED`. |
| UPSTREAM-5 | Medium if it failed | `get` | A path from input must not split the request or add fields, nor name another origin. | **Holds.** `get` refuses a path that does not start with `/`, so an absolute-form or asterisk target is not sent; the head is written by `http1WriteRequestHead`, which refuses a path that is not a request target; the call then fails `UPSTREAM_E_REQUEST` and nothing is sent. A head longer than `maxHead` fails the same way. |
| UPSTREAM-6 | Medium if it failed | `get`, `release`, `dispatch` | Calls must not queue without bound, nor connections multiply. | **Holds.** `get` takes one of `calls` slots, made at start-up, or answers `UPSTREAM_E_FULL` and holds nothing; a slot is held until `release`. At most `connections` sockets are open, each under its own watch id. |
| UPSTREAM-7 | Low | `take`, `release` | `release` of a call already released, or never taken, put its slot on the free list twice, so two later calls shared a slot and one request could be handed another's answer. | **Fixed.** A slot is marked taken by `take` and `release` panics unless it is. `tests/link/net_upstream_release` releases a call twice: it printed `FAIL` and exited 0 before the fix, and panics now. A slot is marked by whether it is taken, not by which call took it, so `release` of a stale handle, one already released and whose slot a later `get` has taken again, releases the later call's slot: the program's misuse, which a generation count could catch and does not. |
| UPSTREAM-8 | Medium | `parse` (the codec's `next`) | The codec allocates a response's field names and values, and its reason phrase, as strings, on each response. In a long-running server the arena grows with every call: about 168 bytes a call against the test's mock origin, more for an origin that sends more fields, up to `maxHeaderBytes`. | **Fixed.** The codec gained a spans mode (`fieldsAsSpans`): each field and the reason phrase are copied into a `head` buffer the parser reuses and recorded as spans, and a string is made only when `header`, `fieldName`, `fieldValue` or `reasonText` asks. `reset()` readies a parser for a new connection with its buffers kept, so each connection keeps one parser (`connect`, `upstreamParser`). Before: `Arena.used()` grew 504,344 bytes over 3,000 warm calls, about 168 a call. After: "warm pool: Arena.used() flat over two thousand calls past a thousand of warm-up" in `tests/link/net_upstream`, which compares `Arena.mark()` and `Arena.used()` before and after and would fail on one byte. |
| UPSTREAM-9 | Low | `pump` | A deadline is checked only when the program reads the pool (`ready`, `take`) after a handler turn. A program that calls `h.wait(-1)` with nothing else to wake it holds a call past its deadline. | **Accepted.** As HANDLER-5 records for bodies, a timed wait is the program's. The guide's loop waits with a timeout. |
| UPSTREAM-10 | Low | `settle` | The lookup blocks for up to `lookupMs`, once, in the constructor; one address is kept, with no fallback to another and no refresh. | **Accepted.** Pinning one checked address is what makes UPSTREAM-4 hold; an origin that moves needs a new `Upstream`. Start-up may block. |
| UPSTREAM-11 | Low | `settle` | Only `http:` is spoken: a call's request and response are in clear, readable and changeable on the path. | **Accepted.** `https:` is refused (`UPSTREAM_E_ORIGIN`) rather than downgraded. Use it for an origin on a network the program trusts, such as a service beside it. |
| UPSTREAM-12 | Medium | `receive` | A read that failed (`netRead` below 0 and not would-block, a reset say) was handed to the codec as the close. A body read until close then ended whole, so the call was answered `ok` with only the part that came before the reset. | **Fixed.** A failed read ends the call `UPSTREAM_E_RESET` and closes the connection; only a read of 0 is the close. "reset: a reset in a close-delimited body fails the call UPSTREAM_E_RESET, not ok with what came" printed `FAIL` before the fix. |
| UPSTREAM-13 | Medium | `idle`, `dispatch`, `finish` | An idle kept-alive connection was taken for the next call without a look at it. If the origin had closed it, the call failed with a refusal or a close it never caused; if the origin had written to it, those bytes were read as the call's response, the very mixing UPSTREAM-2 rules out. | **Fixed.** `usable` reads an idle connection before it is reused: anything but would-block closes it, and the call takes another. A call on a reused connection that ends in a failure before any byte of its answer came is made once more, on a new connection, at most once (`finish`, `UpstreamResponse.retried`); a timeout is not retried. The three "idle:" and "retry:" lines printed `FAIL` before the fix. A retry can repeat a request the origin already read: a reset after the head was written but before any byte of the answer is retried. That is safe because the pool sends only `GET`, which is idempotent; a method with effects could not be retried this way. |
| UPSTREAM-14 | Low | `Upstream` | There is no `close`. An `Upstream`'s connections, their poll registrations and its slots live until the program exits, and nothing frees an `Upstream` the program drops. | **Accepted.** A pool is made once per origin at start-up and kept for the program's life, as the guide says; an origin that moves (UPSTREAM-10) is the case a `close` would serve. The guide states the limit. |

## Properties verified

Each property below is pinned by a line of
`tests/link/net_upstream/expected.out`, which
`link/net_upstream: exits with 0 and stdout matches expected.out` compares
byte for byte. The program drives a real handler, real upstreams and mock
origins over loopback sockets.

**A slow origin** (UPSTREAM-3): "slow: the call reached the slow server, and
get returned at once", "slow: another client is answered by the program
meanwhile", "slow: and through a second upstream", "slow: both inside the slow
call's deadline", "slow: the slow call ends UPSTREAM_E_TIMEOUT and its client
gets a 504", "slow: its slot and connection are given back".

**Keep-alive and tagging** (UPSTREAM-2): "keep-alive: five calls in a row are
answered, each tagged with its request", "keep-alive: on one connection",
"keep-alive: the request head is the path and the origin's Host".

**Refusals** (UPSTREAM-1, UPSTREAM-2): "refusal: a malformed status line fails
the call with code 1", "refusal: a bare LF fails the call with code 3",
"refusal: conflicting framing fails the call with code 6", "refusal: a body
past maxBody fails the call with code 14", "refusal: a body cut short fails
the call with code 10", "refusal: the next call is answered on a new
connection".

**The policy** (UPSTREAM-4): "policy: a loopback origin is refused at
start-up", "policy: and each call fails UPSTREAM_E_BLOCKED with nothing
connected", "policy: permitted, the same origin is called".

**The origin and the request** (UPSTREAM-5, UPSTREAM-11): "origin: https,
userinfo and a path are each UPSTREAM_E_ORIGIN", "request: a path that is not
a request target is UPSTREAM_E_REQUEST".

**A warm pool** (UPSTREAM-6, UPSTREAM-8): "warm pool: three thousand calls are
answered", "warm pool: on the one connection, with every slot back and no body
buffer grown", "warm pool: Arena.used() flat over two thousand calls past a
thousand of warm-up".

**Reuse** (UPSTREAM-2, UPSTREAM-12, UPSTREAM-13): "idle: a connection the
origin closed while idle is not reused, and the next call is answered",
"idle: bytes the origin sent while the connection was idle are not the next
call's response", "retry: a call the origin drops unanswered on a reused
connection is made once more on a new one", "reset: a close-delimited body
ends at the origin's close", "reset: a reset where the origin's close would
end a close-delimited body fails the call UPSTREAM_E_RESET, not ok". The reset
check cannot tell a reset in the body from one before the head, since a reset
may discard bytes the origin already sent; either way the call must not be
`ok`.

**Caps before the wire** (UPSTREAM-4, UPSTREAM-5, UPSTREAM-6): "connections:
three calls with one connection allowed share it, one after another",
"request: an absolute-form or asterisk path is UPSTREAM_E_REQUEST, with
nothing sent", "calls: with every slot taken, get answers UPSTREAM_E_FULL and
holds nothing", "calls: once the slot is released, get takes a call again",
"request: a request head past maxHead is UPSTREAM_E_REQUEST, with nothing
sent", "request: and one that fits is called", "policy: a host name the policy
does not allow is refused before any lookup".

**A late reply** (UPSTREAM-2, UPSTREAM-3): "late reply: a call past its
deadline fails UPSTREAM_E_TIMEOUT and its connection is closed before the
reply is due", "late reply: the next call gets its own response, on a new
connection". The reply the origin would send late has no connection left to
arrive on, so the check pins the close, not a reply discarded.

**Framing, bounds and the failure codes** (UPSTREAM-1, UPSTREAM-2,
UPSTREAM-3, UPSTREAM-4, UPSTREAM-5, UPSTREAM-13): "framing: a Connection:
close response closes its connection, and the next call opens a new one",
"framing: bytes past a response in the same read close its connection, and
are not the next call's", "body: a body of maxBody is taken whole, in a buffer
under twice maxBody", "request: a CR, LF or space in a path is
UPSTREAM_E_REQUEST, with nothing sent", "closed: a call the origin drops on
its retry's new connection too fails UPSTREAM_E_CLOSED, made twice in all",
"deadline: a call queued behind the connections cap fails UPSTREAM_E_TIMEOUT
at the deadline get gave it", "connect: a refused connection fails the call
UPSTREAM_E_CONNECT", "policy: an allowed name that resolves only to refused
addresses is UPSTREAM_E_BLOCKED", "lookup: a name with no address is
UPSTREAM_E_LOOKUP".

**A second release** (UPSTREAM-7): `link/net_upstream_release: exits with 1
and stderr matches expected.stderr`.

**Argued, not pinned.** `release` of a call never taken panics on the same
`!taken` test the second release reaches; no test makes that call. The 1 GiB
clamp on `maxBody` is not driven by a test, which would need a body past
1 GiB. Neither has a line of its own.
