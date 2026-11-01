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
over-long response left behind is read as the next call's answer. Under an
`OutboundPolicy` the origin's host name is checked before the lookup and its
addresses after it, and the pool connects only to the bytes that were checked,
with no second lookup. Review before merge found one fault and fixed it with a
test (UPSTREAM-7). One is open: the codec allocates each response's field
names and values as strings, so the arena grows with every call (UPSTREAM-8,
Medium). Three properties are limits by design, recorded as accepted
(UPSTREAM-9 to UPSTREAM-11).

## Scope

| File | Functions |
| --- | --- |
| `std/net/upstream.ts` | `UpstreamLimits`; `UpstreamResponse`; `Upstream` (`settle`, `fail`, `get`, `ready`, `take`, `release`, `pending`, `openConnections`, `pump`, `dispatch`, `idle`, `connect`, `service`, `send`, `receive`, `parse`, `finish`, `end`, `interest`, `close`); `UpstreamConnection`; the helpers `upstreamParser`, `upstreamAppend` |

Out of scope: the response codec and `http1WriteRequestHead`
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

## Findings

Rows UPSTREAM-1 to UPSTREAM-6 are the shapes an attacker's traffic can take,
each checked and found to hold. UPSTREAM-7 was fixed before merge and is
counted as fixed in the index; UPSTREAM-8 is open; UPSTREAM-9 to UPSTREAM-11
are accepted.

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| UPSTREAM-1 | High if it failed | `parse`, `upstreamAppend`, `upstreamParser` | A response must not grow a call's buffers past the caps, nor be taken as whole when the codec refused it. | **Holds.** Each connection's codec is made with `maxStatusLine`, `maxHeaderBytes`, `maxHeaders`, `maxBody` and `maxTrailerBytes`; `upstreamAppend` only appends what the codec handed over, so a body buffer is at most twice `maxBody`. Every `HTTP1_ERROR` ends the call with the codec's code, `ok === false` and `length === 0`. |
| UPSTREAM-2 | High if it failed | `finish`, `close`, `parse`, `receive` | An answer must reach the request that asked and no other: a late, malformed or extra response must not be read as the next call's. | **Holds.** A call's slot carries its `req` from `get` to `take`. A connection whose call ended any way but whole is closed (`finish`), so a response that arrives after its call timed out goes nowhere. A connection is kept only when the codec says keep-alive and holds no byte past the response (`buffered() === 0`); bytes on an idle connection close it (`receive`). |
| UPSTREAM-3 | High if it failed | `get`, `connect`, `send`, `receive`, `pump` | A slow or silent origin must not stall the handler's loop or another client. | **Holds.** Connects, writes and reads are non-blocking and run only when the poll says the socket is ready; `get` writes into its slot and returns. Each call has a deadline, `timeoutMs` after `get`, checked on connections and on calls still queued; past it the call ends `UPSTREAM_E_TIMEOUT` and its connection closes. |
| UPSTREAM-4 | High if it failed | `settle` | Under a policy, the pool must not connect to an address it refuses, including through a name that resolves to one or a second lookup that answers differently. | **Holds.** `outboundHostAllowed` checks the name before the lookup; `outboundFilter` drops every refused address from the one answer; the first address left is copied and is the only one ever connected to. A refused origin connects nothing, and every call fails `UPSTREAM_E_BLOCKED`. |
| UPSTREAM-5 | Medium if it failed | `get` | A path from input must not split the request or add fields. | **Holds.** The head is written by `http1WriteRequestHead`, which refuses a path that is not a request target; the call then fails `UPSTREAM_E_REQUEST` and nothing is sent. A head longer than `maxHead` fails the same way. |
| UPSTREAM-6 | Medium if it failed | `get`, `release`, `dispatch` | Calls must not queue without bound, nor connections multiply. | **Holds.** `get` takes one of `calls` slots, made at start-up, or answers `UPSTREAM_E_FULL` and holds nothing; a slot is held until `release`. At most `connections` sockets are open, each under its own watch id. |
| UPSTREAM-7 | Low | `take`, `release` | `release` of a call already released, or never taken, put its slot on the free list twice, so two later calls shared a slot and one request could be handed another's answer. | **Fixed.** A slot is marked taken by `take` and `release` panics unless it is. `tests/link/net_upstream_release` releases a call twice: it printed `FAIL` and exited 0 before the fix, and panics now. |
| UPSTREAM-8 | Medium | `parse` (the codec's `next`) | The codec allocates a response's field names and values, and its reason phrase, as strings, on each response. In a long-running server the arena grows with every call: about 168 bytes a call against the test's mock origin, more for an origin that sends more fields, up to `maxHeaderBytes`. | **Open.** It cannot be closed in this module: a parser made per call cannot be scoped to an arena, and the fields are the codec's. The fix belongs in `nish/net/http1-client`: record a field as a span of the head, as the server carrier does. The stage asked for a test that the arena stays flat over thousands of calls; it would fail until then and is not written. `tests/link/net_upstream` pins the rest: three thousand warm calls run on one connection with every slot back and no body buffer grown. |
| UPSTREAM-9 | Low | `pump` | A deadline is checked only when the program reads the pool (`ready`, `take`) after a handler turn. A program that calls `h.wait(-1)` with nothing else to wake it holds a call past its deadline. | **Accepted.** As HANDLER-5 records for bodies, a timed wait is the program's. The guide's loop waits with a timeout. |
| UPSTREAM-10 | Low | `settle` | The lookup blocks for up to `lookupMs`, once, in the constructor; one address is kept, with no fallback to another and no refresh. | **Accepted.** Pinning one checked address is what makes UPSTREAM-4 hold; an origin that moves needs a new `Upstream`. Start-up may block. |
| UPSTREAM-11 | Low | `settle` | Only `http:` is spoken: a call's request and response are in clear, readable and changeable on the path. | **Accepted.** `https:` is refused (`UPSTREAM_E_ORIGIN`) rather than downgraded. Use it for an origin on a network the program trusts, such as a service beside it. |

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
buffer grown".

**A second release** (UPSTREAM-7): `link/net_upstream_release: exits with 1
and stderr matches expected.stderr`.
