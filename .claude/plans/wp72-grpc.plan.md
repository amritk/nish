---
name: WP72 — gRPC over the HTTP/2 server
overview: The nish/net/http-server façade serves HTTP/2 over TLS and h2c but no RPC protocol on top, so a Nish service cannot speak gRPC and an HttpArena entry scores 0 on both gRPC profiles. Build protobuf's wire format (S1), trailers on the façade's HTTP/2 answers (S2), unary gRPC calls on its two HTTP/2 listeners (S3) and a stock-client interop check (S4); generated message classes (S5) and streaming (S6) are deferred.
spec: docs/wp72-grpc.md
priority: 5
labels: [ready]
issue: 2008
stages:
  - id: s1-protobuf
    title: WP72 S1 — nish/net/protobuf, protobuf's wire format, with its security record
    goal: A schema-less reader and writer over a u8[] span in std/net/protobuf.ts, the reader skipping unknown fields by wire type and refusing every overrun with a code, never a panic, landing with docs/security/protobuf.md and its index row.
    verification: node tests/run.js protobuf && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    issue: 2009
    todos:
      - id: s1-reader
        content: Add the reader to std/net/protobuf.ts — next() for field number and wire type, varint to 64 bits (int32 negatives in the ten-byte form), zigzag sint, fixed32, fixed64, a length-delimited span, skip by wire type, groups refused — see WP72 S1
        status: pending
      - id: s1-refusals
        content: Give the reader a refusal code each for a varint past ten bytes, a length past the span, field number 0 or past 2^29 − 1, a group, and nesting past the depth cap, with a tests/link negative per code — see WP72 S1
        status: pending
      - id: s1-writer
        content: Add the writer to std/net/protobuf.ts, writing into the caller's buffer and growing it as JsonWriter does, with no allocation per field once warm — see WP72 S1
        status: pending
      - id: s1-vectors
        content: Check in test vectors made by the reference implementation with the command that made them, and round-trip them through the reader and writer in tests/link — see WP72 S1
        status: pending
      - id: s1-record
        content: Write docs/security/protobuf.md (scope std/net/protobuf.ts, each refusal with its test) and its row in docs/security/README.md so security-scope passes — see WP72 S1
        status: pending
      - id: s1-docs
        content: Document every public declaration with a param and returns tag, regenerate docs/reference with gen-reference, and add nish/net/protobuf to docs/guide/using-nish/standard-library.md — see WP72 S1
        status: pending
  - id: s2-trailers
    title: WP72 S2 — trailers on the nish/net/http-server façade's HTTP/2 answers
    goal: A handler on the façade can end an HTTP/2 answer (TLS or h2c) with a trailer section sent through Http2Connection.writeTrailers, and the same call on an HTTP/1.1 or HTTP/3 request panics in the façade's misuse class.
    verification: node tests/run.js http_server && node tests/run.js net_http2 && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    issue: 2013
    todos:
      - id: s2-api
        content: Add the façade call that ends an HTTP/2 answer with trailer names and values in std/net/http-server.ts, routed to Http2Connection.writeTrailers for both HTTP/2 listeners — see WP72 S2
        status: pending
      - id: s2-misuse
        content: Make the same call panic on an HTTP/1.1 or HTTP/3 request, as the façade's other misuse does, with a tests/link negative for each — see WP72 S2
        status: pending
      - id: s2-tests
        content: Add tests/link cases that read the trailing HEADERS frame back over TLS and over h2c, including a body-less answer — see WP72 S2
        status: pending
      - id: s2-docs
        content: Update docs/security/http-server.md for the new path, docs/http-one-handler.md, docs/guide/using-nish/http-server.md, and regenerate docs/reference — see WP72 S2
        status: pending
  - id: s3-grpc-unary
    title: WP72 S3 — nish/net/grpc, unary calls on the façade's HTTP/2 listeners
    goal: A program serves unary gRPC calls as routes on the façade's two HTTP/2 listeners, with the length-prefixed message, grpc-status trailers or the Trailers-Only form, grpc-timeout deadlines, docs/security/grpc.md and a guide page.
    verification: node tests/run.js grpc && node tests/run.js protobuf && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: pending
    issue: 2014
    todos:
      - id: s3-route
        content: Add std/net/grpc.ts, a call as a route on its /package.Service/Method path, refusing any content-type but application/grpc and application/grpc+proto with 415 — see WP72 S3
        status: pending
      - id: s3-message
        content: Read the request's length-prefixed message — compressed flag answered UNIMPLEMENTED, a length past the cap RESOURCE_EXHAUSTED, a length that disagrees with the body INTERNAL — see WP72 S3
        status: pending
      - id: s3-answer
        content: Answer 200 with application/grpc, the length-prefixed reply and grpc-status and grpc-message trailers through S2, and an error with no message in the Trailers-Only form — see WP72 S3
        status: pending
      - id: s3-deadline
        content: Parse grpc-timeout into the request's deadline, capped by the handler's own timeouts, answering a call past it DEADLINE_EXCEEDED, with a tests/link negative for a malformed value — see WP72 S3
        status: pending
      - id: s3-tests
        content: Add tests/link cases for GetSum over TLS and over h2c, each status code above, and the Trailers-Only form — see WP72 S3
        status: pending
      - id: s3-record
        content: Write docs/security/grpc.md (scope std/net/grpc.ts) and its row in docs/security/README.md — see WP72 S3
        status: pending
      - id: s3-guide
        content: Write docs/guide/using-nish/grpc.md with the GetSum service as its example, its route in scalar.config.json, and regenerate docs/reference — see WP72 S3
        status: pending
  - id: s4-interop
    title: WP72 S4 — a stock gRPC client against both HTTP/2 listeners in the interop job
    goal: The interop workflow builds a Nish GetSum server and calls it over TLS and over h2c on every run with pinned grpcurl, failing on a wrong sum or a wrong grpc-status, and with a short pinned ghz run, failing on any non-OK call.
    verification: the new job in .github/workflows/interop.yml is green on the PR head, and node tests/run.js ci-scope passes
    status: pending
    issue: 2016
    todos:
      - id: s4-server
        content: Add a GetSum server program under tests/interop that listens with listenHttp2Tls and listenH2c — see WP72 S4
        status: pending
      - id: s4-job
        content: Add a job to .github/workflows/interop.yml, modelled on the h2spec job, that fetches pinned grpcurl by checksum and checks a sum, an error status and a past-deadline call on both listeners — see WP72 S4
        status: pending
      - id: s4-ghz
        content: Add a short ghz run to the same job, fetched pinned by checksum, against both listeners, failing on any non-OK call and recording no throughput claim — see WP72 S4
        status: pending
      - id: s4-scope
        content: Trace the new job's reads into scripts/ci-scope.mjs and add its per-command case to node tests/run.js ci-scope — see WP72 S4
        status: pending
  - id: s5-proto-classes
    title: WP72 S5 — message classes generated from a .proto file
    goal: A generator writes Nish message classes with their encode and decode on S1's reader and writer from a .proto file, as nish schema does for JSON.
    verification: node tests/run.js protobuf && node tests/run.js link && npm run check && npm run lint
    status: pending
    labels: [deferred]
    issue: 2017
    todos:
      - id: s5-design
        content: Write the generator's design in docs/wp72-grpc.md (which proto3 constructs map to which Nish types, what is refused) before any code — see WP72 S5
        status: pending
  - id: s6-streaming
    title: WP72 S6 — streaming gRPC calls
    goal: Client-streaming, server-streaming and bidirectional calls run on the façade's HTTP/2 listeners on top of S3's unary path.
    verification: node tests/run.js grpc && npm run check && npm run lint
    status: pending
    labels: [deferred]
    issue: 2019
    todos:
      - id: s6-design
        content: Write the streaming design in docs/wp72-grpc.md (how a handler reads and writes messages across DATA frames, flow control, cancellation) before any code — see WP72 S6
        status: pending
---

# WP72 — gRPC over the HTTP/2 server

## Context

`std/net` serves HTTP/1.1, HTTP/2 over TLS and h2c, and HTTP/3 behind one handler ([`nish/net/http-server`](../../std/net/http-server.ts), WP39 G7), but no RPC protocol on top. gRPC is the one a Nish service is most often asked to speak, and it is two of [HttpArena](../../docs/wp71-httparena.md)'s scored profiles (`unary-grpc` over h2c, `unary-grpc-tls`), worth up to 2,000 of the board's 19,000; an entry with no gRPC scores 0 on both.

Built today: `listenHttp2Tls` and `listenH2c` on the façade, a request body held whole up to `limits.maxBody`, and `Http2Connection.writeTrailers` in [`std/net/http2.ts`](../../std/net/http2.ts). Missing: a way for the façade's `start`/`write`/`end` to send trailers, protobuf's wire format, and gRPC's framing, status and deadlines. Spec: [the design note](../../docs/wp72-grpc.md), [§1](../../docs/wp72-grpc.md#1-what-is-built-and-what-is-missing).

S1 and S2 do not depend on each other and can be built in parallel. S3 needs both. S4 needs S3.

## Approach

The design note's decisions are settled as it recommends ([§6](../../docs/wp72-grpc.md#6-decisions)):

- **D1** — the wire format lives in `std/net/protobuf.ts`, so `node scripts/security-scope.mjs` holds its decoder to a record from the first commit.
- **D2** — codecs by hand first on S1's reader and writer; the generator is S5, deferred. HttpArena's messages are three `int32` fields.
- **D3** — no gRPC client in this package (see Out of scope).
- **D4** — gRPC on the port that serves HTTP/1.1 is WP39's open question (h2c by preface), not this package's. `unary-grpc-tls` needs no change to it; `unary-grpc` on 8080 waits on it.

## WP72 S1 — nish/net/protobuf, protobuf's wire format, with its security record

Spec: [§2 The wire format](../../docs/wp72-grpc.md#2-the-wire-format-nishnetprotobuf-s1).

A reader and a writer over a `u8[]` span, with no schema and no generated code, in `std/net/protobuf.ts` (`nish/net/protobuf`).

- **Reading.** `next()` answers a field's number and wire type; the value is then read as a varint (to 64 bits, `int32` negatives in the ten-byte form protobuf writes), a zigzag `sint`, a `fixed32` or `fixed64`, or a length-delimited span. A field the caller does not ask for is skipped by its wire type. Groups (wire types 3 and 4) are refused.
- **Refusals.** Each is a code, never a panic, since the bytes come from a peer: a varint longer than ten bytes, a length past the span, a field number of 0 or past 2²⁹ − 1, a group, and a nested message past a depth cap. Each code has a `tests/link` negative.
- **Writing.** Into a caller's buffer, growing it as `JsonWriter` does, with no allocation per field once warm.
- **Vectors.** Bytes made by the reference implementation (`protoc --encode` or the Python `protobuf` package), checked in beside the command that made them; each decodes to the expected fields and each re-encodes byte for byte.
- **Record.** `docs/security/protobuf.md` (scope `std/net/protobuf.ts`; each refusal with its before/after test) and its row in [`docs/security/README.md`](../../docs/security/README.md), in the same PR — `std/net/**` is attacker-facing to `node scripts/security-scope.mjs`.
- **Docs.** Every public declaration has a doc comment, a `@param` per parameter and a `@returns`; `node scripts/gen-reference.mjs` rewrites `docs/reference/`. The module gets its row and section in [`docs/guide/using-nish/standard-library.md`](../../docs/guide/using-nish/standard-library.md).

Likely files: `std/net/protobuf.ts`, `tests/link/net_protobuf_*`, `docs/security/protobuf.md`, `docs/security/README.md`, `docs/reference/`, `docs/guide/using-nish/standard-library.md`. A `tests/fuzz/targets` entry for the reader is welcome but not required.

## WP72 S2 — trailers on the nish/net/http-server façade's HTTP/2 answers

Spec: [§3 Trailers on the façade](../../docs/wp72-grpc.md#3-trailers-on-the-façade-s2).

gRPC puts a call's outcome in trailers (`grpc-status`, `grpc-message`) after the response's DATA. The façade (`HttpServer.start`, `write`, `end` in [`std/net/http-server.ts`](../../std/net/http-server.ts)) gets a way to end an HTTP/2 answer with a trailer section, sent through `Http2Connection.writeTrailers` ([`std/net/http2.ts`](../../std/net/http2.ts)), on both `listenHttp2Tls` and `listenH2c`.

On HTTP/1.1 and HTTP/3 the same call panics, in the façade's misuse class, until a profile asks for it: chunked trailers on HTTP/1.1 and a trailing HEADERS frame on HTTP/3 are each their own change to a carrier.

- The façade keeps "nothing allocates per request": trailer names and values are the caller's arrays, as `start`'s are.
- Tests read the trailing HEADERS frame (END_STREAM set) back over TLS and over h2c, after a body and after a body-less answer, and one negative per refusing version.
- Docs: [`docs/security/http-server.md`](../../docs/security/http-server.md) for the new path, [`docs/http-one-handler.md`](../../docs/http-one-handler.md), [`docs/guide/using-nish/http-server.md`](../../docs/guide/using-nish/http-server.md), and `docs/reference/` regenerated.

## WP72 S3 — nish/net/grpc, unary calls on the façade's HTTP/2 listeners

Spec: [§4 `nish/net/grpc`: unary calls](../../docs/wp72-grpc.md#4-nishnetgrpc-unary-calls-s3). Needs S1 and S2.

On the façade's two HTTP/2 listeners, in `std/net/grpc.ts` (`nish/net/grpc`):

| Piece | Rule |
| --- | --- |
| Route | `:path` is `/<package>.<Service>/<Method>`; the router matches it as any other path. `content-type` other than `application/grpc` or `application/grpc+proto` is answered 415. |
| Message | One length-prefixed message: a compressed-flag byte, a four-byte big-endian length, the message. Compressed → `UNIMPLEMENTED` (no `grpc-encoding` is offered). Length past the cap → `RESOURCE_EXHAUSTED`. Length that disagrees with the body → `INTERNAL`. |
| Answer | `:status` 200, `content-type: application/grpc`, the length-prefixed reply, then `grpc-status` (and `grpc-message`) trailers through S2. An error with no message is the Trailers-Only form: one HEADERS frame with `grpc-status`, ending the stream. |
| Deadline | `grpc-timeout` sets the request's deadline, capped by the handler's own timeouts (`HttpServerLimits`); a call past it is `DEADLINE_EXCEEDED`. A malformed value is refused, not ignored. |

It reads the network, so it lands with `docs/security/grpc.md` (scope `std/net/grpc.ts`, findings with tests) and its index row, and with a guide page `docs/guide/using-nish/grpc.md` (HttpArena's `GetSum` as the worked example, its codec by hand on S1) and its route in `scalar.config.json`. Tests in `tests/link` cover `GetSum` over TLS and h2c, each status above and the Trailers-Only form.

## WP72 S4 — a stock gRPC client against both HTTP/2 listeners in the interop job

Spec: [§5 Stages](../../docs/wp72-grpc.md#5-stages). Needs S3.

A Nish `GetSum` server under `tests/interop/`, listening with `listenHttp2Tls` and `listenH2c`, called by two stock gRPC clients in one new job in [`.github/workflows/interop.yml`](../../.github/workflows/interop.yml), modelled on its `h2spec` job. Each client is fetched at a pinned version with its SHA-256 checked.

- **`grpcurl`, for correctness.** On both listeners: a correct sum, an error `grpc-status`, and a call past its `grpc-timeout`. It fails on a wrong answer, not only on a crash.
- **`ghz`, for load.** A short run on both listeners at many streams per connection, the shape HttpArena drives. It fails on any non-OK call. It is a stability check, not a benchmark: the job records no throughput figure, and WP71's runs own those.

The new job's reads are traced into `scripts/ci-scope.mjs` with a per-command case in `node tests/run.js ci-scope` (CLAUDE.md, "A CI lane reads what its commands read").

Decided (owner, 2026-11-20): both clients, `grpcurl` for correctness and `ghz` for load.

## WP72 S5 — message classes generated from a .proto file

Spec: [§5 Stages](../../docs/wp72-grpc.md#5-stages) (S5) and [§6](../../docs/wp72-grpc.md#6-decisions) D2. **Deferred.**

A generator writes message classes with their encode and decode from a `.proto` file, as `nish schema` does for JSON ([WP62](../../docs/wp62-json-schema-classes.md)), emitting calls to S1's reader and writer. Until then a program writes its messages' codecs by hand on S1, which is all two three-field messages need. Pick it up when a program needs more messages than are worth writing by hand; the design goes in the design note before any code.

## WP72 S6 — streaming gRPC calls

Spec: [§5 Stages](../../docs/wp72-grpc.md#5-stages) (S6). **Deferred.**

Client-streaming, server-streaming and bidirectional calls on S3's unary path. HttpArena scores only unary calls. The design (reading and writing messages across DATA frames, flow control, cancellation through `RST_STREAM`) goes in the design note before any code.

## Out of scope

From the design note's [Not planned](../../docs/wp72-grpc.md#not-planned) list and D3:

- gRPC-Web.
- Server reflection.
- Message compression (`grpc-encoding`); a compressed message is answered `UNIMPLEMENTED`.
- Health checking as a built-in service.
- A gRPC client (D3): `nish/net/fetch` is HTTP/1.1, and a client needs an HTTP/2 client first.
- gRPC on the port that serves HTTP/1.1 (D4): WP39's open question, not this package's.
- Trailers on HTTP/1.1 and HTTP/3 answers (S2 refuses them).

## Tests

| Stage | Cases | Mirror |
| --- | --- | --- |
| S1 | reference vectors decode and re-encode byte for byte; one negative per refusal code; skip of every wire type | the `tests/link/net_http2_frame*` codec cases |
| S2 | trailing HEADERS read back over TLS and h2c; panics on HTTP/1.1 and HTTP/3 | the `tests/link/net_http_server*` cases |
| S3 | `GetSum` on both listeners; 415, `UNIMPLEMENTED`, `RESOURCE_EXHAUSTED`, `INTERNAL`, `DEADLINE_EXCEEDED`; Trailers-Only | S2's cases |
| S4 | a stock client on both listeners in CI | the `h2spec` job in `.github/workflows/interop.yml` |

A new diagnostic code, if any stage adds one, lands with a `tests/link` negative that provokes it.

## Verification

Per stage, its `verification:` line above, plus CLAUDE.md's definition of done: `npm run check`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, `node scripts/gen-reference.mjs --check`, `node scripts/security-scope.mjs` for S1 and S3, the goldens regenerated with `node tests/self/goldens.js --update` for any `std/` change, and every CI test shard green on the PR head.
