# Security record: `nish/net/grpc` — unary gRPC calls

The record of `nish/net/grpc` (#2014): unary gRPC calls on
`nish/net/http-server`'s HTTP/2 listeners. A call is a route the program adds
to the server's `Router`. `GrpcServer.call` reads the request the server
handed over as a call: its version, its `content-type`, its `grpc-timeout`
and the length prefix of its one message. It answers every fault itself.
`reply` and `fail` answer the calls it hands to the program. The message's
contents are protobuf, read by the program with `nish/net/protobuf`, which has
[its own record](protobuf.md).

It says what `call` refuses and with which answer, what it caps and where,
and the line of `tests/link/net_grpc`'s `expected.out` that pins each
property. It is written with the code, against `main` at `2354c33`, and cites
functions rather than lines.

**Result.** No request a peer sends makes the module panic, read outside the
request's head or body, or allocate in proportion to the request. A request
off HTTP/2 is answered 505. A `content-type` other than `application/grpc` or
`application/grpc+proto` is answered 415. A malformed `grpc-timeout` (not 1 to
8 ASCII digits followed by one of `H M S m u n`) is `INTERNAL`. A call
already past its deadline is `DEADLINE_EXCEEDED`. A compressed message is
`UNIMPLEMENTED`. A declared length past `maxMessage` is `RESOURCE_EXHAUSTED`.
A body that is not exactly one length-prefixed message is `INTERNAL`. Each of
these is answered before the program sees the call. A program's
`grpc-message` is percent-encoded, so no byte of it can end its field. No
finding is counted; four properties are recorded as accepted (GR-1 to GR-4).

## Scope

| File | Functions |
| --- | --- |
| `std/net/grpc.ts` | `GrpcLimits`; `GrpcServer` (`call`, `messageStart`, `expired`, `reply`, `fail`, and the internal `only`, `statusValue`, `timeout`, `framing`); the helper `grpcPercentEncode` |

Out of scope: the HTTP/2 connection, its HPACK and flow control, and the
façade that reads a request's head and body and sends its answer and trailers
(`docs/security/http-server.md` and the HTTP/2 records). Also out of scope:
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

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| GR-1 | None (a property) | `GrpcServer.reply`, `fail`, `expired` | The deadline is checked when the program answers, not by a timer. A call the program holds stays open, holding its stream and its request slot, until the program answers it or the connection closes. | **Accepted, not counted; documented.** The module keeps no state per call, so it has no turn of its own to time out in. `reply` and `fail` answer `DEADLINE_EXCEEDED` past the deadline, and `expired` lets a program that holds calls drop the stale ones. Pinned by "answering it after 50 ms" and "reply sends DEADLINE_EXCEEDED, not the message". |
| GR-2 | None (a property) | `GrpcServer.timeout` | A request with two `grpc-timeout` fields is read by its first. | **Accepted, not counted.** Either value is capped at `maxTimeout`, so the peer gains nothing by sending two. |
| GR-3 | None (a property) | `GrpcServer.only` | The Trailers-Only HEADERS frame carries `content-length: 0` beside `content-type` and `grpc-status`, which the façade adds to every HTTP/2 head whose body length it knows. A server that advertises HTTP/3 also adds `alt-svc` to it over TLS, as it does to every head there. | **Accepted, not counted.** gRPC's Trailers-Only form names the fields it needs and does not forbid others. Pinned by each Trailers-Only check, which matches `content-type=application/grpc grpc-status=<s> content-length=0`. |
| GR-4 | None (a property) | `GrpcServer.call` | A call without `te: trailers` is answered. The match on `content-type` is exact, so a value with parameters or in another case is answered 415. | **Accepted, not counted.** `te` tells proxies the client reads trailers; the server sends them either way. gRPC defines no `content-type` parameters. Pinned by "content-type text/plain: 415" and "content-type application/grpc+json: 415". |

Nothing was found while the module was written that reached a commit, so
nothing is counted.

## Properties verified

Each property below is pinned by a line of `tests/link/net_grpc`'s
`expected.out`, so the check that fails when one stops holding is
`link/net_grpc: exits with 0 and stdout matches expected.out`. Its line names
are quoted after each property. The case runs one `HttpServer` with an HTTP/2
over TLS, an h2c and an HTTP/1.1 listener on loopback, a `GrpcServer` with
`maxMessage` 64 over it, and scripted clients in the same process.

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

## Not pinned

- GR-2 (two `grpc-timeout` fields) is read from the code, not tested.
- No fuzz target drives `call` yet. The properties above are pinned by
  `net_grpc`'s checks alone.
- A `reply` whose stream closes between its head and its trailers
  (`HANDLER_DROPPED`) is not reached by a test.
- The 505 is pinned over HTTP/1.1 only; a call over HTTP/3 takes the same
  branch of `call` but no check sends one.
- No check sends a message of exactly `maxMessage` bytes, a 0-length message,
  or a prefix split across DATA frames. The façade hands `call` the whole
  body, so a split prefix reads as one.
- No check calls `reply` or `fail` twice on one call, or `fail` after
  `reply`.
