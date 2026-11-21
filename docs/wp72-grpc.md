# WP72: gRPC over the HTTP/2 server

**Status: proposed, design only; nothing in `std/` is built for it.** The
anchors are at `f2b8933f`.

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

It reads the network, so it lands with `docs/security/grpc.md` and its index
row, and with a guide page under `docs/guide/` and its route.

## 5. Stages

- **S1:** `nish/net/protobuf`, the wire format, with its record.
- **S2:** trailers on the façade's HTTP/2 answers.
- **S3:** `nish/net/grpc`, unary calls, with its record and guide page.
- **S4:** interop: a stock gRPC client (`grpcurl`, or `ghz` for load) against
  both listeners in the interop job (`.github/workflows/interop.yml`).
- **S5** *(deferred)*: message classes from a `.proto` file, written by a
  generator with their encode and decode, as `nish schema` does for JSON
  ([wp62](wp62-json-schema-classes.md)). Until then a program writes its
  messages' codecs by hand on S1's reader and writer, which is all two
  three-field messages need.
- **S6** *(deferred)*: streaming calls, client, server and both.

## 6. Decisions

| | Question | Recommendation |
| --- | --- | --- |
| **D1** | Where the wire format lives | **`std/net/protobuf.ts`**, so the scope check holds its decoder to a record from the first commit |
| **D2** | A generator first, or codecs by hand | **By hand first** (S1), the generator deferred (S5): HttpArena's messages are three `int32` fields, and the reader and writer are what a generator would emit calls to |
| **D3** | A gRPC client | **Not in this package.** `nish/net/fetch` is HTTP/1.1; a client needs an HTTP/2 client first |
| **D4** | gRPC on the port that serves HTTP/1.1 | **WP39's question, not this package's.** `unary-grpc-tls` needs no change to it; `unary-grpc` on 8080 waits on it |

## Not planned

gRPC-Web, server reflection, message compression (`grpc-encoding`), and
health checking as a built-in service.
