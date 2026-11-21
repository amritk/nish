# WP72: gRPC over the HTTP/2 server

**Status: S1 to S6 built; S6, streaming calls, is §7, on the façade's
streaming request bodies (S6a).** §1's table is the state
when the package was proposed, at `f2b8933f`; the stages in §5 say what each
one added.

`std/net` serves HTTP/1.1, HTTP/2 over TLS and cleartext, and HTTP/3 behind
one handler (`nish/net/http-server`, [wp39](wp39-http-server.md) G7), but no
RPC protocol on top of them. gRPC is the one a service written in Nish is
most often asked to speak. It is also one of HttpArena's five scored
families: two profiles, `unary-grpc` over h2c and `unary-grpc-tls`, worth up
to 2,000 of the overall board's 19,000 ([wp71](wp71-httparena.md) §1). An
entry with no gRPC scores 0 on both.

What HttpArena's profiles ask
([unary](https://www.http-arena.com/docs/test-profiles/grpc/unary/implementation/)):

```proto
service BenchmarkService { rpc GetSum (SumRequest) returns (SumReply); }
message SumRequest { int32 a = 1; int32 b = 2; }
message SumReply { int32 result = 1; }
```

The call is `POST /benchmark.BenchmarkService/GetSum` over h2c on port 8080,
the port that also serves HTTP/1.1 and WebSocket, and over TLS on 8443, at
256 and 1,024 connections with 100 streams each.

## 1. What is built and what is missing

What was there when the package was proposed; S1 to S3 built the missing
rows, and S6a gave the façade request bodies in pieces.

| Piece | State at `f2b8933f` |
| --- | --- |
| HTTP/2 over TLS and h2c, behind one handler | Built: `listenHttp2Tls` and `listenH2c` on `nish/net/http-server` |
| A request's body, held whole up to `limits.maxBody` | Built |
| Trailers on a response | `Http2Connection.writeTrailers` exists in `std/net/http2.ts`; the façade's `start`, `write` and `end` cannot send them |
| h2c on the HTTP/1.1 port | Refused by design: [http-one-handler.md](http-one-handler.md) §4, "no sniffing". WP39 holds it as an open question |
| Protobuf's wire format | Missing |
| gRPC's framing, status and deadlines | Missing |

## 2. The wire format: `nish/net/protobuf` (S1)

A reader and a writer over a `u8[]` span, with no schema and no generated
code:

- **Reading.** `next()` answers a field's number and wire type; the value
  is then read as a varint (to 64 bits, with `int32`'s negative values as the
  ten-byte form protobuf writes them), a zigzag `sint`, a `fixed32` or
  `fixed64`, or a length-delimited span. A field the caller does not ask
  for is skipped by its wire type. Groups (wire types 3 and 4) are refused.
- **Refusals.** A varint longer than ten bytes, a length past the span, a
  field number of 0 or past 2²⁹ − 1, and a nested message past a depth cap
  are each a code, never a panic: the bytes come from a peer.
- **Writing.** Into a caller's buffer, growing it as `JsonWriter` does, with
  no allocation per field once warm.

It lives under `std/net/` although it is not a transport. `node
scripts/security-scope.mjs` takes `std/net/**` as attacker-facing, so the
decoder's record (`docs/security/protobuf.md`) is required of it from the
first commit. Test vectors are bytes made by the reference implementation,
checked in with the command that made them.

## 3. Trailers on the façade (S2)

gRPC puts a call's outcome in trailers (`grpc-status`, `grpc-message`), after
the response's DATA. The façade gets a way to end an HTTP/2 answer with a
trailer section, through `Http2Connection.writeTrailers`. On HTTP/1.1 and
HTTP/3 the same call is refused in the misuse class (a panic, as the façade's
other misuse is) until a profile asks for it: chunked trailers on HTTP/1.1 and
a trailing HEADERS frame on HTTP/3 are each their own change to a carrier.

## 4. `nish/net/grpc`: unary calls (S3)

On the façade's two HTTP/2 listeners:

- **A call is a route.** `:path` is `/<package>.<Service>/<Method>`, so the
  router matches it as any other path. `content-type` must be
  `application/grpc` or `application/grpc+proto`; anything else is answered
  415, as a gRPC server does.
- **The message.** The body is one length-prefixed message: a compressed
  flag byte and a four-byte big-endian length, then the message. A
  compressed message is answered `UNIMPLEMENTED`, since no `grpc-encoding` is
  offered; a length past the cap, `RESOURCE_EXHAUSTED`; a length that
  disagrees with the body, `INTERNAL`.
- **The answer.** `:status` 200, `content-type: application/grpc`, the
  length-prefixed reply, then the trailers. An error with no message is the
  Trailers-Only form: one HEADERS frame with `grpc-status`, ending the stream.
- **Deadlines.** `grpc-timeout` sets the request's deadline, capped by the
  handler's own timeouts; a call past it is answered `DEADLINE_EXCEEDED`.
  (Superseded: the cap is `GrpcLimits.maxTimeout`, as the next paragraph
  says.)

As built in S1, `GrpcServer` sits on an `HttpServer` and keeps no state per
unary call (S6's streaming calls keep theirs, §7):

- `call(r)` answers every fault itself and returns `GRPC_CALL` only for a
  call the program should answer. A request off HTTP/2 is answered 505,
  since a gRPC client never sends one and the trailers it needs exist only
  there.
- The cap on a deadline is `GrpcLimits.maxTimeout` (30 s by default), not a
  handler timeout: the façade has none per request. A call without
  `grpc-timeout` gets the cap as its deadline. The deadline runs from
  when the head was read (`r.since`). `call`, `reply` and `fail` answer
  `DEADLINE_EXCEEDED` past it, and `expired(r)` lets a program that holds
  calls drop the stale ones; nothing times a held call out by itself.
- A malformed `grpc-timeout` (not 1 to 8 digits and one of `H M S m u n`) is
  answered `INTERNAL`. The value is compared with the cap before it is
  scaled, so no unit overflows.
- The length cap is `GrpcLimits.maxMessage` (4 MiB by default, gRPC's own
  default), behind `HttpServerLimits.maxBody`.
- `fail` percent-encodes `grpc-message`, and with an empty message answers
  in the Trailers-Only form. The Trailers-Only HEADERS frame carries `:status`
  200, `content-type`, `grpc-status` and `content-length: 0`; the façade adds
  `alt-svc` too on a TLS listener when the server advertises HTTP/3.

`tests/link/net_grpc` pins the answers on three listeners and a second
server:

- over TLS: GetSum, and both forms of an error;
- over h2c: GetSum, the content-types, every framing fault, both forms of an
  error, a CR, LF and NUL in `grpc-message`, and the deadlines;
- on a second h2c server whose `maxTimeout` is 60 ms: the cap;
- over HTTP/1.1: only the 505.

The malformed `grpc-timeout` values are its negative cases, since a refusal
there needs a running server, not a compile error.

It reads the network, so it lands with `docs/security/grpc.md` and its index
row, and with a guide page under `docs/guide/` and its route.

## 5. Stages

- **S1:** `nish/net/protobuf`, the wire format, with its record.
- **S2:** trailers on the façade's HTTP/2 answers.
- **S3:** `nish/net/grpc`, unary calls, with its record and guide page.
- **S4:** interop: a stock gRPC client (`grpcurl`, or `ghz` for load) against
  both listeners in the interop job (`.github/workflows/interop.yml`).

  As built, the interop job's `grpc` job runs the server
  `tests/link/net_grpc_interop` builds into the interop image
  (`/grpc-server serve`). It serves S3's test service (`tests/link/net_grpc/rig.ts`)
  on a TLS listener and an h2c one and caps every call's deadline at 1 s
  (`CAP_MS`). `tests/interop/grpc/check.sh` calls it from
  `tests/interop/grpc/benchmark.proto`, since the server offers no reflection.
  It runs twelve checks on each listener, and the job fails on any one:

  - grpcurl's GetSum 2 + 3 answers `{"result": 5}`, and -5 + 3 answers `-2`;
  - Denied ends PERMISSION_DENIED with the message `no 100% é`, decoded from
    its percent-encoding;
  - Missing ends NOT_FOUND with no message;
  - Slow, called with a 10 s deadline (`-max-time 10`), ends DEADLINE_EXCEEDED with no message,
    in under 5 s, so it is the server's capped deadline that answered, not
    grpc-go's own timeout (two checks: the status, then the time);
  - SumAll sums three streamed requests to 5; Count answers 7 8 9 in order,
    and 200 replies of 4 KiB padding, 0 to 199 in order, past one HTTP/2
    window; Echo answers each request's sum, 3 then 11;
  - ghz makes 2000 GetSum calls, 10 at a time, and every one is OK. It is a
    stability check: no throughput is recorded;
  - ghz makes 300 Missing calls on its one connection, and every one is
    NOT_FOUND, none refused.

  grpcurl 1.9.3 and ghz 0.120.0 are fetched by release and their SHA-256s
  checked before either runs, as h2spec is. The job runs on a pull request
  that touches any file it reads: a check in `node tests/run.js ci-scope`
  follows the server's imports and fails on one the workflow's `paths` do
  not name (`docs/wp10-ci.md`, "Scoped lanes").
- **S5:** message classes from a `.proto` file, written by `nish proto` with
  their encode and decode, as `nish schema` does for JSON
  ([wp62](wp62-json-schema-classes.md)). The guide page is
  [protobuf-classes.md](guide/using-nish/protobuf-classes.md).
- **S6a:** request bodies in pieces on the façade's HTTP/2 listeners
  (`HttpServer.streamBody`, `consume`).
- **S6:** streaming calls, client, server and both, on S6a's bodies and the
  façade's repeated writes: §7.

## 6. Decisions

| | Question | Recommendation |
| --- | --- | --- |
| **D1** | Where the wire format lives | **`std/net/protobuf.ts`**, so the scope check holds its decoder to a record from the first commit |
| **D2** | A generator first, or codecs by hand | **By hand first** (S1), the generator after it (S5, built): HttpArena's messages are three `int32` fields, and the reader and writer are what a generator would emit calls to |
| **D3** | A gRPC client | **Not in this package.** `nish/net/fetch` is HTTP/1.1; a client needs an HTTP/2 client first |
| **D4** | gRPC on the port that serves HTTP/1.1 | **WP39's question, not this package's.** `unary-grpc-tls` needs no change to it; `unary-grpc` on 8080 waits on it |

## 7. Streaming calls (S6)

A streaming call is a route like a unary one. What changes is that the
request, the answer or both are a sequence of length-prefixed messages
instead of one. The program marks a client-streaming or bidirectional
method's route with `HttpServer.streamBody`, so its request comes out of
`take` at its head and again for each piece of body, its end or a reset
(S6a). A server-streaming method's route needs no mark: its one request
message arrives whole, as a unary call's does.

### The calls

| Method | What it does | Answers |
| --- | --- | --- |
| `open(r)` | Checks a call whose request is a stream of messages: HTTP/2, the content-type, `grpc-timeout`, a deadline already past; the same refusals as `call`, without its check that the body is one message | `GRPC_CALL`, or `GRPC_ANSWERED` when it answered |
| `next(r)` | Reads the next request message | `GRPC_MESSAGE`, `GRPC_MORE`, `GRPC_END` or `GRPC_ANSWERED` |
| `messageBytes(r)`, `messageStart(r)`, `messageEnd(r)` | The message `next` (or `call`) found, as `bytes[start .. end)` | valid until the next `next` |
| `begin(r)` | Sends the answer's head: `:status` 200 and `content-type: application/grpc` | a handler code |
| `send(r, buf, off, len)` | Writes one reply message, beginning the answer if it has not begun | the bytes `pending` after it, ≥ 0, or `GRPC_ENDED` (−1) once the call is over |
| `finish(r, status, message)` | Ends the call with `grpc-status` and, when `message` is not empty, `grpc-message` | a handler code |

`call` panics on a request with `streaming` set: its body is not whole, so a
check that it is one message cannot hold. `fail` on a call that has begun
ends it as `finish` does.

### The message reader

`next` reads messages across DATA frames. It keeps, per request slot, a read
offset into `r.body`, and the length of a message it is part way through.

- **Several messages in one piece** are each a window into `r.body`: no copy.
  `next` advances its offset past each, and hands the bytes it read back with
  `consume` only when it needs more, so a body of `n` messages is shifted
  once, not `n` times.
- **A message split across pieces** is copied into a per-call buffer as its
  bytes arrive, each piece handed back with `consume` once copied, so the
  peer is credited window for it and the body never has to hold the whole
  message. The buffer is grown to the message's length, which `maxMessage`
  has already bounded, and kept for the call's next messages.
- **A prefix split across pieces** (fewer than 5 bytes) waits, unconsumed.

It answers the call itself, and returns `GRPC_ANSWERED`, on a fault:

| Fault | Answer |
| --- | --- |
| A message whose prefix declares more than `maxMessage` bytes | RESOURCE_EXHAUSTED, before any byte of it is copied |
| A compressed message (flag 1) | UNIMPLEMENTED: no `grpc-encoding` is offered |
| A flag byte other than 0 or 1 | INTERNAL |
| The body ends part way through a prefix or a message | INTERNAL |
| The deadline has passed | DEADLINE_EXCEEDED |
| The client hung up (`hungUp`: a reset, or the connection gone) | CANCELLED, which the façade drops |

Each answer is trailers when the call's answer has begun, and Trailers-Only
when it has not. `GRPC_MORE` says to wait until `take` hands `r` over again;
`GRPC_END` says the client's stream ended between messages, and the program
answers with `finish`.

### `send` and backpressure

`send` writes the 5-byte prefix and the message with the façade's `write`.
The façade queues what the connection cannot yet take, so `send` never
blocks; it returns `HttpServer.pending(r)`, the bytes still queued. A
program streaming many messages stops while that count is above a budget of
its own and goes back to its wait, checking `pending(r)` again each turn;
nothing wakes it when the count drains, so a program with no other work
waits with a short timeout. A slow reader therefore costs the server the
program's budget plus one message, not the whole answer.

### `finish` and trailers

`finish` on a call whose answer has begun sends trailers: `grpc-status` and,
when `message` is not empty, `grpc-message`, percent-encoded. On one that has
not begun it answers Trailers-Only when `message` is empty, and otherwise
sends the head then the trailers, as `fail` does for a unary call.

### Cancellation and deadlines while a call streams

- **A client cancel** is RST_STREAM. The façade marks the request reset and
  hands it over again; `hungUp(r)` is then true, and the program's next
  `next`, `send` or `finish` gives it back (`GRPC_ANSWERED`, `GRPC_ENDED` or
  `HANDLER_DROPPED`). A call answered before its body ended is reset with
  NO_ERROR by the façade, so the client may stop sending.
- **The deadline** is the call's `grpc-timeout`, capped by `maxTimeout`,
  counted from when the server read the request's head (`r.since`), as for a
  unary call. `next`, `send` and `finish` each check it,
  and past it end the call DEADLINE_EXCEEDED. The façade's `bodyTimeout`
  does not cover a streamed body, so a client that sends nothing more is
  answered only when the program asks: a program holding streaming calls
  checks `expired(r)` for each one on every turn of its loop, as the unary
  rig does for its held calls.

## Not planned

gRPC-Web, server reflection, message compression (`grpc-encoding`), and
health checking as a built-in service.
