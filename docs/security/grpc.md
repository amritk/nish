# Security record: `nish/net/grpc` — gRPC calls, unary and streaming

The record of `nish/net/grpc` (#2014, and streaming calls in #2019): gRPC
calls on `nish/net/http-server`'s HTTP/2 listeners. A call is a route the
program adds to the server's `Router`. `GrpcServer.call` reads the request
the server handed over as a unary call: its version, its `content-type`, its
`grpc-timeout` and the length prefix of its one message. `open` reads the
same head checks for a streaming call, and `next` reads its request messages
one at a time as the client's DATA frames arrive. Each answers every fault
itself. `reply` and `fail` answer a unary call; `begin`, `send` and `finish`
answer a streaming one with any number of reply messages. The message's
contents are protobuf, read by the program with `nish/net/protobuf`, which has
[its own record](protobuf.md).

It says what `call` refuses and with which answer, what it caps and where,
and the line of `tests/link/net_grpc`'s `expected.out` that pins each
property. It is written with the code, against `main` at `2354c33` for unary
calls and at `002673c` for streaming ones, and cites functions rather than
lines.

**Result.** No request a peer sends makes the module panic, read outside the
request's head or body, or allocate in proportion to the request beyond
`maxMessage` per open call (GR-7). A request
off HTTP/2 is answered 505. A `content-type` other than `application/grpc` or
`application/grpc+proto` is answered 415. A malformed `grpc-timeout` (not 1 to
8 ASCII digits followed by one of `H M S m u n`) is `INTERNAL`. A call
already past its deadline is `DEADLINE_EXCEEDED`. A compressed message is
`UNIMPLEMENTED`. A declared length past `maxMessage` is `RESOURCE_EXHAUSTED`.
A body that is not exactly one length-prefixed message is `INTERNAL`. Each of
these is answered before the program sees the call. A program's
`grpc-message` is percent-encoded, so no byte of it can end its field. On a
streaming call `next` answers the same framing faults, a message the client's
stream ends inside, a deadline passed mid-stream and a client that hung up,
each without handing the program a message. One Medium finding was fixed
and is counted: GR-5, a slot every Trailers-Only answer kept until its
connection closed (on `main` before this change). Five properties are
recorded as accepted (GR-1 to GR-4, GR-7).

## Scope

| File | Functions |
| --- | --- |
| `std/net/grpc.ts` | `GrpcLimits`; `GrpcServer` (`call`, `open`, `next`, `messageBytes`, `messageStart`, `messageEnd`, `expired`, `begin`, `send`, `finish`, `reply`, `fail`, and the internal `admit`, `slot`, `at`, `held`, `over`, `gone`, `close`, `setPrefix`, `only`, `statusValue`, `timeout`, `framing`); the helper `grpcPercentEncode` |

Out of scope: the HTTP/2 connection, its HPACK and flow control, and the
façade that reads a request's head and body, hands a streamed body over piece
by piece (`streamBody`, `consume`, `bodyEnded`, `hungUp`) and sends its
answer, its queued writes and its trailers (`docs/security/http-server.md`
and the HTTP/2 records). Also out of scope:
the message's protobuf contents, which the program reads with
`nish/net/protobuf` (`docs/security/protobuf.md`), and the program's own
choice of status and message.

## Threat model

The input is a request a peer sent on an HTTP/2 stream: its `:path`, every
header, and every byte of its body are the attacker's. The server has already
held the body to `HttpServerLimits.maxBody` (413 past it) and the head to its
own limits. The program trusts its own `GrpcLimits`, its reply message and its
`grpc-message` text. The attacker wins if a request makes the module:

- read outside the request's head or body;
- panic, or allocate in proportion to the request;
- hand the program a call whose message is not exactly the body after a
  well-formed prefix, or a call it then cannot answer;
- hold a call longer than `maxTimeout` asks of a program that checks
  `expired`, or turn a deadline into an overflow;
- put bytes into the answer's fields that end a field or start another.

On a streaming call the body arrives in pieces the peer chooses: a prefix or
a message may be split anywhere, several may share one DATA frame, the
stream may end inside either, and the peer may reset the stream or stop
reading the answer at any point. The attacker also wins if a sequence of
calls on one connection makes the module:

- hand the program a message assembled from the wrong bytes, or one after
  the call was answered;
- leave the server holding a stream slot, or a request, for a call it has
  answered;
- queue reply messages without bound, or hide from the program that the
  peer stopped reading.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| GR-1 | None (a property) | `GrpcServer.reply`, `fail`, `expired` | The deadline is checked when the program answers, not by a timer. A call the program holds stays open, holding its stream and its request slot, until the program answers it or the connection closes. | **Accepted, not counted; documented.** The module has no timer and no turn of its own, so nothing times a call out until the program calls into it. `reply` and `fail` answer `DEADLINE_EXCEEDED` past the deadline, and `expired` lets a program that holds calls drop the stale ones. Pinned by "answering it after 50 ms" and "reply sends DEADLINE_EXCEEDED, not the message". |
| GR-2 | None (a property) | `GrpcServer.timeout` | A request with two `grpc-timeout` fields is read by its first. | **Accepted, not counted.** Either value is capped at `maxTimeout`, so the peer gains nothing by sending two. |
| GR-3 | None (a property) | `GrpcServer.only` | The Trailers-Only HEADERS frame carries `content-length: 0` beside `content-type` and `grpc-status`, which the façade adds to every HTTP/2 head whose body length it knows. A server that advertises HTTP/3 also adds `alt-svc` to it over TLS, as it does to every head there. | **Accepted, not counted.** gRPC's Trailers-Only form names the fields it needs and does not forbid others. Pinned by each Trailers-Only check, which matches `content-type=application/grpc grpc-status=<s> content-length=0`. |
| GR-4 | None (a property) | `GrpcServer.call` | A call without `te: trailers` is answered. The match on `content-type` is exact, so a value with parameters or in another case is answered 415. | **Accepted, not counted.** `te` tells proxies the client reads trailers; the server sends them either way. gRPC defines no `content-type` parameters. Pinned by "content-type text/plain: 415" and "content-type application/grpc+json: 415". |
| GR-5 | Medium (denial of service) | `GrpcServer.only` | A Trailers-Only answer (every error without a message, from `call` and from the program's `fail`) was sent with `HttpServer.start` and never handed back with `end`. The head ends the stream, but the façade kept the request, and with it one of the connection's stream slots (at most 100, fewer for a small `requests`), until the connection closed. After that many such answers every later call on the connection was refused with `RST_STREAM REFUSED_STREAM`, so a peer sending malformed calls, or a client meeting ordinary `NOT_FOUND`s, wedged its own connection and held the server's request slots. | **Fixed** (c8321737): `only` calls `end` after `start`, whether the head went or the stream closed first. Pinned by "Trailers-Only over TLS: 150 calls on one connection, each NOT_FOUND, none refused" and its h2c twin, which failed before the fix, and by the interop job's 300 Missing calls on one ghz connection. The bug was on `main` (`2354c33`). |
| GR-7 | None (a property) | `GrpcServer.next`, `grow`, `over` | A message that does not fit in the body piece at hand is copied into a buffer of the call's own. The buffer grows as the message's bytes arrive, from 1 KiB (`GRPC_GROW_FROM`), doubling and capped at the length the prefix declares, so a peer is held to about twice the bytes it has sent; a body that has already ended short of the declared length is answered `INTERNAL` before anything is allocated for the message. A peer that sends a message's bytes slowly can still make the server hold up to `maxMessage` bytes for as long as the call is open. The buffer is kept for the slot's next call when it is at most 64 KiB (`GRPC_KEEP`) and dropped when the call ends otherwise. | **Accepted, not counted.** The memory is bounded by `maxMessage` times the calls open at once, which the program sets (`maxMessage`, the server's `requests`). A program serving untrusted streaming clients sets `maxMessage` to the largest message its methods read. A call held this way still ends at its deadline when the program checks `expired`. |

GR-5 is counted, as Medium: it let a peer deny service by exhausting a
connection's stream slots. GR-1 to GR-4 and GR-7 are properties and are not
counted.

## Properties verified

Each property below is pinned by a line of `tests/link/net_grpc`'s
`expected.out`, so the check that fails when one stops holding is
`link/net_grpc: exits with 0 and stdout matches expected.out`. Its line names
are quoted after each property. The case runs one `HttpServer` with an HTTP/2
over TLS, an h2c and an HTTP/1.1 listener on loopback, a `GrpcServer` with
`maxMessage` 64 over it, and scripted clients in the same process. Every
streaming check runs once over TLS and once over h2c; the TLS name is quoted.

**A call is answered over both HTTP/2 listeners.** GetSum is answered 200
with `content-type: application/grpc`, its reply's 5-byte prefix and 2 bytes,
then a trailer section with `grpc-status: 0` that ends the stream, over TLS
and over h2c ("GetSum: 200, application/grpc, SumReply { result: 5 }
length-prefixed, then grpc-status 0 in trailers", "GetSum over h2c: SumReply {
result: 42 } and grpc-status 0"). The two forms of an error are answered over
both as well (below). The content-type, framing and deadline checks run over
h2c only: `call` reads them the same way on either listener.

**Only HTTP/2 and gRPC's own content-types are calls.** A call over HTTP/1.1
is answered 505 ("a gRPC call over it: 505"). `application/grpc+proto` is a
call ("content-type application/grpc+proto is a call too");
`text/plain` and `application/grpc+json` are answered 415 ("content-type
text/plain: 415", "content-type application/grpc+json: 415").

**The message is exactly the body after one well-formed prefix.** `framing`
reads the five bytes of the prefix only once it has checked that the body
holds them. It compares the declared length, as an `i64`, with `maxMessage`
before it compares it with the body, so a length of 2^31 or more cannot wrap
("a length of 2^31, and of 2^32 - 1: RESOURCE_EXHAUSTED, not wrapped").
A compressed flag is `UNIMPLEMENTED` ("a compressed message: UNIMPLEMENTED"),
and a length past `maxMessage` is `RESOURCE_EXHAUSTED` ("a length past
maxMessage: RESOURCE_EXHAUSTED"). Each of the following is `INTERNAL`:

- a length the body does not match, either way ("a length the body does not
  match: INTERNAL", "a body longer than its declared length: INTERNAL");
- an empty body, or one shorter than the prefix ("no length prefix:
  INTERNAL", "a body of 1 byte, and of 4, shorter than the prefix:
  INTERNAL");
- a flag byte other than 0 or 1 ("an unknown flag byte: INTERNAL").

None of them reaches the program ("the program saw only the five well-formed
calls").

**A deadline is capped and cannot overflow.** `timeout` reads at most eight
digits, so the value is below 10^8, and compares it with `maxTimeout` divided
by the unit's scale before it multiplies, so 99999999 hours is capped, not
wrapped. On a second server whose `maxTimeout` is 60 ms, a call asking for
99999999 hours and a call asking for nothing are both handed to the program
("grpc-timeout 99999999H and none: both held by the program, neither
refused"). Both are past their deadline 120 ms later, so `reply` answers each
`DEADLINE_EXCEEDED` ("answered after 120 ms, both are past maxTimeout", "reply
sends DEADLINE_EXCEEDED for each: the cap is maxTimeout, not what was
asked"). A call already past its deadline is `DEADLINE_EXCEEDED` before the
program sees it ("grpc-timeout 1n: DEADLINE_EXCEEDED before the program sees
the call"), and one within it is answered ("grpc-timeout 1S: answered",
"grpc-timeout 99999999H: answered"). Each of seven malformed values is
`INTERNAL`, pinned by its own line `grpc-timeout "<value>": INTERNAL`: no
unit (`100`), no digits (`S`), an unknown unit (`1x`), nine digits
(`123456789S`), a sign (`-1S`, `+1S`), and nothing at all (`""`). None of
them reaches the program ("the program saw the held call and the three it
answered, none malformed").

**An error is answered in the form its message needs.** An error without a
message is one HEADERS frame that ends the stream: `:status` 200,
`content-type: application/grpc` and `grpc-status`, with no DATA ("an error
without one: Trailers-Only", and over h2c "over h2c too, an error without
one: Trailers-Only"). An error with one is a head, then a trailer section
with `grpc-status` and `grpc-message` ("an error with a message: a head, then
grpc-status and the message percent-encoded", and over h2c "over h2c too, an
error with a message: a head, then grpc-status and the message
percent-encoded").

**A `grpc-message` cannot end its field.** `grpcPercentEncode` writes every
byte outside `0x20` to `0x7e`, and `%`, as `%XX`, so a CR, LF or NUL in the
program's text reaches the peer as three printable bytes. One check sends
`no 100% é` and reads `no 100%25 %C3%A9` ("an error with a message: a head,
then grpc-status and the message percent-encoded"). Another sends `a`, CR,
LF, `b`, NUL, `c` and reads `a%0D%0Ab%00c` ("a CR, LF and NUL in grpc-message
reach the peer as %0D, %0A and %00").

**The program's own mistakes panic, never the peer's bytes.** A `GrpcLimits`
outside its range, a `reply` window outside its buffer, and a `fail` status
outside 1 to 16 panic with a message that names them. Every index `call`,
`timeout` and `framing` take from the request is checked against the head or
the body first.

**Panic sites: the program's mistakes and the clock.** Every index, divide
and array-length site in `grpc.ts` is proven by a guard on the head or body
it reads; a call's state is one object reached through a lookup that answers
null for a request it does not hold. What is left are the kept panics, each
an entry with its reason in `tests/std-panics.json`: the constructor's two
limit checks, `call` on a request whose body comes in pieces, `send`'s and
`reply`'s window checks, `finish`'s and `fail`'s status checks, and `held`
(a request that neither `call` nor `open` read); and two `i64` differences of
`monotonicNanos()` and the request's arrival time, itself a `monotonicNanos()`
reading, in `expired` and `admit`, which overflow only for readings 2^63
nanoseconds apart. A new site fails
`std-panics: no std/ module has more panic sites of a kind than tests/std-panics.json allows`
and a kept one that goes fails `std-panics: every kept panic in tests/std-panics.json`.

**A streaming call's messages are the client's bytes, however they were
split.** `next` reads a message whole in the current piece in place, and
copies one split across pieces into the call's buffer, handing each piece
back with `consume` so the client's window reopens. It reads the five prefix
bytes only once the piece holds them, and leaves a partial prefix in place
until it is whole: the three-frame check's first piece is three bytes, a
prefix the stream goes on past. A program reading SumAll gets no answer while the client's
stream is open ("SumAll over TLS: no answer while the client's stream is
open"), the right sum from a message split across three DATA frames ("a
message split across three DATA frames, answered at the end of the stream")
and from three messages in one ("three messages in one DATA frame"). A
bidirectional call's reply goes out before the client's stream ends ("Echo
over TLS: 200 and a reply before the client's stream ends", "the second
reply, then grpc-status 0 at the end of the stream").

**`next` answers every fault in the stream itself.** It compares the declared
length, as an `i64`, with `maxMessage` before it allocates, so a length past
it is `RESOURCE_EXHAUSTED` ("SumAll over TLS: a length past maxMessage:
grpc-status 8"). A compressed message is `UNIMPLEMENTED` ("a compressed
message: grpc-status 12") and another flag byte `INTERNAL` ("an unknown flag
byte: grpc-status 13"). A stream that ends inside a message or inside a
prefix is `INTERNAL` ("a maxMessage-long message the stream ends inside after 2 bytes: grpc-status 13", "a
prefix the stream ends inside: grpc-status 13"). A deadline that passes
between messages is `DEADLINE_EXCEEDED` ("a deadline passing mid-stream is
DEADLINE_EXCEEDED"). A client's `RST_STREAM` ends the call as `CANCELLED`,
which the façade drops, so nothing is sent ("RST_STREAM CANCEL ends the call,
the program's read with it, and nothing is sent"). After each, `next`
answers `GRPC_ANSWERED` and the program reads no message ("each fault ended
the call, none answered by the program"). The program still sees every call,
faulted ones included, through `open` ("streaming over TLS: the program saw
all fourteen calls, the faulted ones too").

**A call the module answered is the server's again.** Every Trailers-Only
answer hands its request back with `end` (GR-5): 150 `NOT_FOUND`s on one
connection, past its 100 stream slots, are each answered and none refused
("Trailers-Only over TLS: 150 calls on one connection, each NOT_FOUND, none
refused"). A streaming call answered before its client's stream ended takes
no later DATA back to the program, since `end` hands its request back, and
the connection's next call is answered ("SumAll over TLS: INVALID_ARGUMENT
before the stream ends; the client's later DATA is not handed back, and the
next call is answered").
Once a call is over, `next`, `send`, `begin`, `finish` and `reply` answer without
touching the request (`GRPC_ANSWERED`, `GRPC_ENDED`, `HANDLER_DROPPED`), so a
program that keeps a stale handle cannot answer it twice until the façade
reuses the request object for a later request. A call's state is kept with
the turn its head was read in and its stream, and a request that differs in
either is not that call's: `fail` on a later request at the same index the
program never read answers it rather than taking the earlier call's state
for its own. Two requests on one index with the same turn and stream are
not told apart; no check reaches that.

**`send` never blocks and never hides backpressure.** It answers the bytes
the connection still queues for the call, so a program stops at a budget of
its own. Against a client that stops reading, a Count loop with a budget
stalls with no more than its budget and one reply queued ("Count over TLS: a
slow reader stalls the sender, no more than its budget and one reply
queued"), and finishes once the window opens ("the window opened, all
hundred replies, then grpc-status 0"). Replies go out in order before the
trailers ("three replies in order, then grpc-status 0"). Past the deadline,
`send` and `finish` both end the call `DEADLINE_EXCEEDED`, `finish` after the
replies already queued ("send past the deadline ends the call
DEADLINE_EXCEEDED", "finish past the deadline ends the call
DEADLINE_EXCEEDED, after the replies queued before it").

## Checked against a stock client

The interop workflow's `grpc` job (`.github/workflows/interop.yml`) runs a
server built from `tests/link/net_grpc_interop` on the same test service, with
every deadline capped at 1 s, and calls it with grpcurl 1.9.3 and ghz 0.120.0,
each fetched by release and checked against its SHA-256 before it runs.
`tests/interop/grpc/check.sh` runs twelve checks on the TLS listener and
twelve on the h2c one, and fails the job on any one. Neither tool verifies the
certificate (grpcurl's `-insecure`, ghz's `--skipTLS`), since the server signs
with a test leaf.

- GetSum 2 + 3 answers 5, and -5 + 3 answers -2.
- Denied's message reaches grpc-go as `no 100% é`, so its percent-encoding
  decodes there, with `PermissionDenied`.
- Missing ends `NotFound` with no message: grpc-go reads the Trailers-Only
  form.
- Slow, called with a 10 s deadline (`-max-time 10`), ends `DeadlineExceeded` with no
  message in under 5 s, so the server's cap answered, not grpc-go's timeout.
- SumAll, sent three messages, answers their sum 5 (client streaming).
- Count answers 7, 8 and 9 in order for three replies, and 0 to 199 in order
  for 200 replies of 4 KiB padding each, more than one HTTP/2 window, so the
  server's sends wait on grpc-go's `WINDOW_UPDATE`s (server streaming).
- Echo, sent two messages, answers each one's sum, 3 then 11
  (bidirectional).
- ghz's 2000 GetSum calls, 10 at a time, are all OK. The job records no
  throughput.
- ghz's 300 Missing calls, one at a time on one connection, are all
  `NotFound` and none is refused: GR-5's pin against a stock client.

The job runs on every push to `main` and on a pull request that changes a
file the server reads (see `docs/wp10-ci.md`, "Scoped lanes"). These checks
call no fault path: every framing, content-type and malformed-timeout case is
pinned by `net_grpc` alone.

## Not pinned

- GR-2 (two `grpc-timeout` fields) is read from the code, not tested.
- No fuzz target drives `call` or `next` yet. The properties above are pinned by
  `net_grpc`'s checks alone.
- A `reply` whose stream closes between its head and its trailers
  (`HANDLER_DROPPED`) is not reached by a test.
- The 505 is pinned over HTTP/1.1 only; a call over HTTP/3 takes the same
  branch of `call` but no check sends one.
- No check sends a message of exactly `maxMessage` bytes or a 0-length
  message.
- No check reuses a request index with a stale handle, so the turn and
  stream test in front of every call's state is read from the code.
- GR-7's buffer kept or dropped at `GRPC_KEEP`, and its growth, are read
  from the code, not tested. That a body already ended short of its declared
  length allocates nothing is read from the code too; the wire answer is
  pinned ("a maxMessage-long message the stream ends inside after 2 bytes:
  grpc-status 13").
- No check calls `reply` or `fail` twice on one call, or `fail` after
  `reply`.
