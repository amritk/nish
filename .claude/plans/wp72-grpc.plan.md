---
name: WP72 — gRPC over the HTTP/2 server
overview: The nish/net/http-server façade serves HTTP/2 over TLS and h2c but no RPC protocol on top, so a Nish service cannot speak gRPC and an HttpArena entry scores 0 on both gRPC profiles. Build protobuf's wire format (S1), trailers on the façade's HTTP/2 answers (S2), unary gRPC calls on its two HTTP/2 listeners (S3) and a stock-client interop check (S4); generated message classes (S5), streaming request bodies on the façade (S6a) and streaming calls (S6) follow.
spec: docs/wp72-grpc.md
priority: 5
labels: [ready]
issue: 2008
stages:
  - id: s1-protobuf
    title: WP72 S1 — nish/net/protobuf, protobuf's wire format, with its security record
    goal: A schema-less reader and writer over a u8[] span in std/net/protobuf.ts, the reader skipping unknown fields by wire type and refusing every overrun with a code, never a panic, landing with docs/security/protobuf.md and its index row.
    verification: node tests/run.js protobuf && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: done
    issue: 2009
    todos:
      - id: s1-reader
        content: Add the reader to std/net/protobuf.ts — next() for field number and wire type, varint to 64 bits (int32 negatives in the ten-byte form), zigzag sint, fixed32, fixed64, a length-delimited span, skip by wire type, groups refused — see WP72 S1
        status: done
      - id: s1-refusals
        content: Give the reader a refusal code each for a varint past ten bytes, a length past the span, field number 0 or past 2^29 − 1, a group, and nesting past the depth cap, with a tests/link negative per code — see WP72 S1
        status: done
      - id: s1-writer
        content: Add the writer to std/net/protobuf.ts, writing into the caller's buffer and growing it as JsonWriter does, with no allocation per field once warm — see WP72 S1
        status: done
      - id: s1-vectors
        content: Check in test vectors made by the reference implementation with the command that made them, and round-trip them through the reader and writer in tests/link — see WP72 S1
        status: done
      - id: s1-record
        content: Write docs/security/protobuf.md (scope std/net/protobuf.ts, each refusal with its test) and its row in docs/security/README.md so security-scope passes — see WP72 S1
        status: done
      - id: s1-docs
        content: Document every public declaration with a param and returns tag, regenerate docs/reference with gen-reference, and add nish/net/protobuf to docs/guide/using-nish/standard-library.md — see WP72 S1
        status: done
  - id: s2-trailers
    title: WP72 S2 — trailers on the nish/net/http-server façade's HTTP/2 answers
    goal: A handler on the façade can end an HTTP/2 answer (TLS or h2c) with a trailer section sent through Http2Connection.writeTrailers, and the same call on an HTTP/1.1 or HTTP/3 request panics in the façade's misuse class.
    verification: node tests/run.js http_server && node tests/run.js net_http2 && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: done
    issue: 2013
    todos:
      - id: s2-api
        content: Add the façade call that ends an HTTP/2 answer with trailer names and values in std/net/http-server.ts, routed to Http2Connection.writeTrailers for both HTTP/2 listeners — see WP72 S2
        status: done
      - id: s2-misuse
        content: Make the same call panic on an HTTP/1.1 or HTTP/3 request, as the façade's other misuse does, with a tests/link negative for each — see WP72 S2
        status: done
      - id: s2-tests
        content: Add tests/link cases that read the trailing HEADERS frame back over TLS and over h2c, including a body-less answer — see WP72 S2
        status: done
      - id: s2-docs
        content: Update docs/security/http-server.md for the new path, docs/http-one-handler.md, docs/guide/using-nish/http-server.md, and regenerate docs/reference — see WP72 S2
        status: done
  - id: s3-grpc-unary
    title: WP72 S3 — nish/net/grpc, unary calls on the façade's HTTP/2 listeners
    goal: A program serves unary gRPC calls as routes on the façade's two HTTP/2 listeners, with the length-prefixed message, grpc-status trailers or the Trailers-Only form, grpc-timeout deadlines, docs/security/grpc.md and a guide page.
    verification: node tests/run.js grpc && node tests/run.js protobuf && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    status: done
    issue: 2014
    todos:
      - id: s3-route
        content: Add std/net/grpc.ts, a call as a route on its /package.Service/Method path, refusing any content-type but application/grpc and application/grpc+proto with 415 — see WP72 S3
        status: done
      - id: s3-message
        content: Read the request's length-prefixed message — compressed flag answered UNIMPLEMENTED, a length past the cap RESOURCE_EXHAUSTED, a length that disagrees with the body INTERNAL — see WP72 S3
        status: done
      - id: s3-answer
        content: Answer 200 with application/grpc, the length-prefixed reply and grpc-status and grpc-message trailers through S2, and an error with no message in the Trailers-Only form — see WP72 S3
        status: done
      - id: s3-deadline
        content: Parse grpc-timeout into the request's deadline, capped by the handler's own timeouts, answering a call past it DEADLINE_EXCEEDED, with a tests/link negative for a malformed value — see WP72 S3
        status: done
      - id: s3-tests
        content: Add tests/link cases for GetSum over TLS and over h2c, each status code above, and the Trailers-Only form — see WP72 S3
        status: done
      - id: s3-record
        content: Write docs/security/grpc.md (scope std/net/grpc.ts) and its row in docs/security/README.md — see WP72 S3
        status: done
      - id: s3-guide
        content: Write docs/guide/using-nish/grpc.md with the GetSum service as its example, its route in scalar.config.json, and regenerate docs/reference — see WP72 S3
        status: done
  - id: s4-interop
    title: WP72 S4 — a stock gRPC client against both HTTP/2 listeners in the interop job
    goal: The interop workflow builds a Nish GetSum server and calls it over TLS and over h2c on every run with pinned grpcurl, failing on a wrong sum or a wrong grpc-status, and with a short pinned ghz run, failing on any non-OK call.
    verification: the new job in .github/workflows/interop.yml is green on the PR head, and node tests/run.js ci-scope passes
    status: done
    issue: 2016
    todos:
      - id: s4-server
        content: Add a GetSum server program under tests/interop that listens with listenHttp2Tls and listenH2c — see WP72 S4
        status: done
      - id: s4-job
        content: Add a job to .github/workflows/interop.yml, modelled on the h2spec job, that fetches pinned grpcurl by checksum and checks a sum, an error status and a past-deadline call on both listeners — see WP72 S4
        status: done
      - id: s4-ghz
        content: Add a short ghz run to the same job, fetched pinned by checksum, against both listeners, failing on any non-OK call and recording no throughput claim — see WP72 S4
        status: done
      - id: s4-scope
        content: Trace the new job's reads into scripts/ci-scope.mjs and add its per-command case to node tests/run.js ci-scope — see WP72 S4
        status: done
  - id: s5-proto-classes
    title: WP72 S5 — nish proto, message classes generated from a .proto file
    goal: "`nish proto <file.proto> -o <out.ts>` writes one deterministic Nish module of message classes, each with an encode onto S1's ProtoWriter and a decode from S1's ProtoReader, for a proto3 subset; every construct outside the subset is refused by name and line, writing nothing."
    verification: node tests/run.js proto && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node examples/break-web/build.mjs --check && NISH=build/nish bash docs/cookbook/regen.sh --check
    status: done
    issue: 2017
    todos:
      - id: s5-design
        content: Write the generator's design in docs/wp72-proto-classes.md before any code — the proto3 subset and its Nish types, the refusals, the generated module's shape, the header and --check — see WP72 S5
        status: done
      - id: s5-parser
        content: Add a .proto lexer and parser in src/proto-*.ts, written in seed constructs only, refusing proto2, imports, groups, extensions and every construct outside the subset with the construct's name and line — see WP72 S5
        status: done
      - id: s5-emit
        content: Emit one class per message with encode(w ProtoWriter) and decode(r ProtoReader) — scalars, string, bytes, enums, nested messages, repeated (packed for scalars, unpacked accepted on read), optional with a presence flag, map with an integer or string key, oneof as a case field, and each service's method paths as constants — see WP72 S5
        status: done
      - id: s5-cli
        content: Dispatch `nish proto` in src/compile.ts beside c-import, its helpText row in src/cli-style.ts with --check, exit codes 0/1/2, and regenerate break-web and docs/reference/command-line.md — see WP72 S5
        status: done
      - id: s5-tests
        content: Golden .proto → .ts cases under tests/proto/, one negative per refusal, and a tests/link program that compiles generated classes and round-trips them byte for byte against vectors made by the reference protobuf implementation (with the command that made them); a tests/run.js section named proto runs them — see WP72 S5
        status: done
      - id: s5-docs
        content: A guide page docs/guide/using-nish/protobuf-classes.md with its scalar.config.json route, the nish proto row in docs/guide/using-nish/cli.md, and a "Generated decoders" section in docs/security/protobuf.md — see WP72 S5
        status: done
  - id: s6a-h2-streaming-bodies
    title: WP72 S6a — streaming request bodies on the façade's HTTP/2 listeners
    goal: A route the program marks as streaming is handed over at its HEADERS frame, and its body arrives as DATA in pieces the program consumes, with the stream's receive window credited only as it consumes them, so a body of any length runs in bounded memory; every other route, and every route on HTTP/1.1 and HTTP/3, keeps today's whole body up to maxBody.
    verification: node tests/run.js net_http_server && node tests/run.js net_http2 && node tests/run.js grpc && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs
    status: done
    issue: 2124
    todos:
      - id: s6a-design
        content: Write the design in docs/http-one-handler.md before any code, replacing the "streaming request bodies" non-goal — how a route opts in, how the program reads a piece and says it consumed it, end of body, the per-stream buffer cap, RST_STREAM and connection loss while held, and what h1 and h3 do with the flag — see WP72 S6a
        status: done
      - id: s6a-window
        content: Let std/net/http2.ts credit a stream's receive window when its consumer says so rather than on arrival, for the streams the façade asks it to, keeping today's eager credit for every other stream and the connection window bounded — see WP72 S6a
        status: done
      - id: s6a-facade
        content: Add the streaming route mode to std/net/http-server.ts — handed over at HEADERS, ready() again on each new piece and at end of body, a peer that overruns the window it was given answered FLOW_CONTROL_ERROR — and expose the response's pending byte count so a writer can hold back — see WP72 S6a
        status: done
      - id: s6a-tests
        content: tests/link cases on h2c and TLS — a body several times maxBody read in pieces in bounded memory, a peer that ignores the window, RST_STREAM and connection loss mid-body, end of body with and without trailers, and the flag on HTTP/1.1 unchanged — see WP72 S6a
        status: done
      - id: s6a-docs
        content: Update docs/guide/using-nish/http-server.md, and docs/security/http-server.md (and http2.md if http2.ts changes) with each finding and its test, and their index rows — see WP72 S6a
        status: done
  - id: s6-streaming
    title: WP72 S6 — streaming gRPC calls
    goal: Client-streaming, server-streaming and bidirectional gRPC calls run on the façade's HTTP/2 listeners, on S6a's streaming bodies and the façade's repeated writes, beside S3's unary path, and a stock gRPC client drives all three in the interop job.
    verification: node tests/run.js grpc && node tests/run.js ci-scope && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs
    status: done
    issue: 2019
    todos:
      - id: s6-design
        content: Write the streaming design as a new section of docs/wp72-grpc.md before any code — a call's message reader across DATA frames and its per-call buffer up to maxMessage, send with backpressure from the pending count, finish with trailers, cancellation and deadlines while streaming — and update the stale status line, §1 and the S5 and S6 bullets — see WP72 S6
        status: done
      - id: s6-server
        content: Server streaming in std/net/grpc.ts — begin, send per message, finish with status — on today's whole-body request — see WP72 S6
        status: done
      - id: s6-client
        content: Client and bidirectional streaming in std/net/grpc.ts on S6a's streaming routes — messages reassembled across DATA frames, each past maxMessage answered RESOURCE_EXHAUSTED, a framing fault INTERNAL, end of stream seen by the program — see WP72 S6
        status: done
      - id: s6-tests
        content: tests/link/net_grpc cases on h2c and TLS for all three kinds — a message split across frames, several messages in one frame, a client cancel by RST_STREAM, a deadline passing mid-stream, backpressure on a slow reader — see WP72 S6
        status: done
      - id: s6-interop
        content: Add a streaming method of each kind to tests/interop/grpc/benchmark.proto, the rig and the interop server, and grpcurl checks in check.sh for each on both listeners — see WP72 S6
        status: done
      - id: s6-docs
        content: Update docs/guide/using-nish/grpc.md (streaming, and a link to the protobuf-classes page), docs/security/grpc.md with each finding and its test, and its index row — see WP72 S6
        status: done
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

## WP72 S5 — `nish proto`, message classes generated from a .proto file

Spec: [§5 Stages](../../docs/wp72-grpc.md#5-stages) (S5) and [§6](../../docs/wp72-grpc.md#6-decisions) D2. Un-deferred by the owner, 2026-11-21. Runs beside S6a.

`nish schema` (WP62) is still a design, so the built model for a generator subcommand is `nish c-import` (WP66 S2): `src/c-import*.ts`, dispatched in `src/compile.ts`, a usage row in `src/cli-style.ts`, golden cases under `tests/c-import/`, a guide page. `nish proto` follows it. The generator is part of the compiler, so it is written in the seed's constructs only (the rolling freeze, `.claude/selfhost.md`).

**The subset.** proto3 only (`syntax = "proto3";`, or no syntax line), one file, no imports:

| proto3 | Nish |
| --- | --- |
| `int32`, `sint32`, `sfixed32` | `i32` |
| `uint32`, `fixed32` | `u32` |
| `int64`, `sint64`, `sfixed64` | `i64` |
| `uint64`, `fixed64` | `u64` |
| `float` / `double` | `f32` / `f64` |
| `bool` / `string` / `bytes` | `boolean` / `string` / `u8[]` |
| `enum` | a numeric `enum`; an unknown value read is kept as its number |
| a message field | `C \| null` |
| `repeated T` | `T[]`, written packed for scalars, read packed or unpacked |
| `optional` scalar | the field plus a `has<Field>` presence flag, since `i32 \| null` is not a Nish type |
| `map<K, V>` with an integer or string `K` | `Map<string, V>`, an integer key held as its decimal string |
| `oneof` | each member as an ordinary field plus a `<oneof>Case` field holding the set member's number, 0 for none |
| `service` | its methods' paths as string constants (`/<package>.<Service>/<Method>`) |

Refused, by construct name and line, writing nothing: proto2, `import`, groups, `extend` and extensions, `reserved` name clashes, a message nested past a depth cap, field numbers outside 1 to 2²⁹ − 1 or in 19000 to 19999, and a duplicate field number. Options other than `package` and `java_*`/`go_*` style file options (ignored, listed in the module's header) are refused too. Unknown fields are skipped on decode and not kept. Well-known types (`google.protobuf.*`) need an import, so they are refused with the rest.

**The module.** One class per message, nested messages named `Outer_Inner`, each with a no-argument constructor, `encode(w: ProtoWriter): void` and `decode(r: ProtoReader): boolean` (false on a reader fault, the fault in `r.failed`). Its header names the generator, the source file and its SHA-256; the output is the same bytes on every run, and `--check` compares the whole file and exits 1 on a difference. Exit codes 0, 1 (refused or stale) and 2 (usage).

The generated decoders read bytes from a peer, so `docs/security/protobuf.md` gains a "Generated decoders" section: what the generated code adds to the reader (a repeated field's growth, a map's growth, nesting), each bound with its test.

Owns:
- `src/proto-*.ts`, `src/compile.ts`, `src/cli-style.ts`
- `tests/proto/**`, `tests/link/net_proto_classes*/**`, `tests/nish/cli.ts`, `tests/run.js` (its new `proto` section only)
- `docs/wp72-proto-classes.md`, `docs/guide/using-nish/protobuf-classes.md`, `docs/guide/using-nish/cli.md`, `scalar.config.json` (the new guide route; `/reference` routes are generated)
- `docs/security/protobuf.md`, `docs/security/README.md` (the protobuf row only)
- generated, regenerated never edited: `tests/self/goldens/checked/**`, `docs/reference/**`, `examples/break-web/help.ts`, `docs/site/break/**`

## WP72 S6a — streaming request bodies on the façade's HTTP/2 listeners

Spec: none yet; the design goes in [`docs/http-one-handler.md`](../../docs/http-one-handler.md), whose non-goals list "streaming request bodies (held whole up to maxBody, 413 above)" today. Runs beside S5.

Why it is its own stage: the façade hands a request over only at END_STREAM (`H2_DATA` appends to `r.body`, `enqueue` runs on END_STREAM), and `Http2Connection.handleData` credits the receive window as each frame arrives, before anyone has read it. A client-streaming gRPC call has no end until the client says so and no length bound, so neither can stay as it is. The response side needs nothing new: a taken request already stays `HELD`/`STREAMING` until `end` or `trailers`, `write` already queues what the carrier cannot take, and `hungUp(r)` already reports `RST_STREAM`.

The shape the design has to settle, with these constraints:

- **Opt-in per route**, set by the program when it adds the route; every other route keeps today's whole body, so no existing program changes.
- **Handed over at HEADERS.** The program reads the piece of body that has arrived, says how many bytes it consumed, and learns end of body (with or without trailers). `ready()` yields the request again when a new piece arrives.
- **Bounded memory.** The stream's receive window is credited when the program consumes, not on arrival, so at most one window per stream is ever held. A peer that sends past the window it was given is `FLOW_CONTROL_ERROR`, as RFC 9113 §6.9 says. The connection window stays credited on arrival, minus what streaming routes hold, so one slow stream cannot stall the others.
- **Cancellation.** `RST_STREAM` or connection loss while the program holds the request reports through `hungUp(r)`, as it does today; the held bytes are released.
- **HTTP/1.1 and HTTP/3.** A streaming route on those carriers gets today's whole body, so a program written for both still runs; streaming them is not in this package.
- **Backpressure out.** The façade exposes the response's pending byte count, which S6's `send` reads.

Owns:
- `std/net/http-server.ts`, `std/net/http2.ts`
- `tests/link/net_http_server_stream*/**`, `tests/link/net_http2_stream*/**`, `tests/nish-cmp.js`, `tests/run.js` (the `HttpServerRequest` layout pin only, if the class's layout moves)
- `docs/http-one-handler.md`, `docs/guide/using-nish/http-server.md`, `docs/security/http-server.md`, `docs/security/http2.md`, `docs/security/README.md` (those two rows only)
- generated, regenerated never edited: `tests/self/goldens/checked/**`, `docs/reference/**`, `tests/link/*/expected.caps.json`

## WP72 S6 — streaming gRPC calls

Spec: [§5 Stages](../../docs/wp72-grpc.md#5-stages) (S6); its design becomes a new section of `docs/wp72-grpc.md`. Un-deferred by the owner, 2026-11-21. Builds on S6a; merges after S5, because it rewrites the design note's S5 bullet to point at S5's page.

`GrpcServer` keeps no state per call today, and `call(r)` requires the whole body to be one message. Streaming needs a per-call reader that reassembles length-prefixed messages across DATA frames, held by the program as it holds `r`, with its buffer capped by `maxMessage`.

- **Server streaming** needs no S6a: `begin(r)` sends the head, `send(r, msg)` one length-prefixed message (answering how much is pending, so a program can hold back), `finish(r, status, message)` the trailers.
- **Client and bidirectional streaming** use an S6a streaming route: each complete message is handed to the program in order, a message past `maxMessage` ends the call `RESOURCE_EXHAUSTED`, a compressed one `UNIMPLEMENTED`, a framing fault `INTERNAL`, and end of stream is visible to the program.
- **Deadlines and cancellation.** `expired(r)` and `hungUp(r)` hold for streaming calls as for held unary ones; `send` and `finish` answer `DEADLINE_EXCEEDED` past the deadline, as `reply` does.
- **Interop.** `benchmark.proto` gains one method of each kind, served by the rig and the interop server, and `check.sh` drives each with grpcurl on both listeners. `.github/workflows/interop.yml` is not edited; if the job's reads change, `node tests/run.js ci-scope` says so.

Owns:
- `std/net/grpc.ts`
- `tests/link/net_grpc/**`, `tests/link/net_grpc_*/**`, `tests/interop/grpc/**`, `tests/nish-cmp.js`
- `docs/wp72-grpc.md`, `docs/guide/using-nish/grpc.md`, `docs/security/grpc.md`, `docs/security/README.md` (the grpc row only)
- generated, regenerated never edited: `tests/self/goldens/checked/**`, `docs/reference/**`, `tests/link/*/expected.caps.json`

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
| S5 | golden `.proto` → `.ts` per construct; one negative per refusal; generated classes round-trip reference vectors byte for byte; `--check` on a stale file exits 1 | `tests/c-import/` and the WP66 S2 section of `tests/run.js` |
| S6a | a body several times `maxBody` in bounded memory on h2c and TLS; a peer past its window; `RST_STREAM` and connection loss mid-body; the flag on HTTP/1.1 unchanged | the `tests/link/net_http_server*` cases |
| S6 | all three kinds on both listeners; a message split across frames and several in one frame; cancel; a deadline mid-stream; a slow reader; grpcurl in CI | S3's and S4's cases |

A new diagnostic code, if any stage adds one, lands with a `tests/link` negative that provokes it.

## Verification

Per stage, its `verification:` line above, plus CLAUDE.md's definition of done: `npm run check`, `npm run lint`, `npm run lint:dead`, `node docs/check-links.mjs`, `node scripts/gen-reference.mjs --check`, `node scripts/security-scope.mjs` for S1 and S3, the goldens regenerated with `node tests/self/goldens.js --update` for any `std/` change, and every CI test shard green on the PR head.
