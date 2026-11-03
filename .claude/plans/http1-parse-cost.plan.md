---
name: Cheaper HTTP/1.1 requests — the parser and the connection hot path
overview: Cut user-space CPU per request in nish/net/http1-server by making the request parser (http1Next and its line and field helpers) scan a vector or a word at a time instead of a byte at a time, and by taking cold fields and repeated work off the Http1Connection feed / inputRoom / respond path. Every limit, status and error message stays the same, proved by a differential test against a frozen copy of the old parser.
stages:
  - id: parser-scan
    title: perf(net) — scan HTTP/1.1 request heads a vector at a time
    goal: http1Next costs measurably fewer ns per head on a loadgen-shaped head and a browser-shaped head, with byte-identical results against the old parser on random and adversarial input
    verification: npm run check && npm run lint && node tests/run.js http1 && node tests/run.js bytes && node tests/run.js performance && node bench/http1-parse/run.mjs
    todos:
      - id: parse-bench
        content: Add bench/http1-parse/ — the ns-per-head micro-benchmark, old vs new vs a byte-identical copy of old, interleaved rounds, median and spread — see Parser scan → Benchmark
      - id: parse-diff
        content: Add tests/link/net_http1_parse_diff/ — random and adversarial heads through a frozen copy of main's parser and the new one, every return code, status, reason, method, target and field compared — see Parser scan → Differential test
      - id: parse-baseline
        content: Record the baseline before any change — ns per head, objdump instructions per byte of the line and field loops, and every performance warning the compiler prints for http1-codec.ts — see Parser scan → Baseline
      - id: parse-line-scan
        content: Rewrite http1TakeLine to find the line end a word or a vector at a time, and stop rescanning bytes already scanned (p.scan) when a head arrives in one read — see Parser scan → Line ends
      - id: parse-span-check
        content: Validate token and field-value bytes over the whole span with a table or a run kernel instead of a branch per byte in http1RequestLine and http1FieldLine — see Parser scan → Span validation
      - id: parse-layout
        content: Order Http1Parser fields hot first and clear its layout warnings; trim per-request work in http1StartRequest, methodIs and http1WriteResponseHead where the measurement shows it — see Parser scan → Layout and small paths
      - id: parse-record
        content: Update docs/security/http1-codec.md and docs/BENCHMARKS.md with what changed, the differential evidence and the measured table — see Parser scan → Record
  - id: conn-hot-path
    title: perf(net) — keep Http1Connection's per-request path on hot fields
    goal: Http1Connection.feed, inputRoom and respond cost measurably fewer ns per request, with no change to any limit or behaviour
    verification: npm run check && npm run lint && node tests/run.js net_http1_server && node tests/run.js http1 && node tests/run.js performance && node bench/http1-conn/run.mjs
    todos:
      - id: conn-bench
        content: Add bench/http1-conn/ — ns per keep-alive request through feed, next, respond on one connection and across many cold connections, old vs new vs a copy of old — see Connection hot path → Benchmark
      - id: conn-baseline
        content: Record the baseline — ns per request, Http1Connection layout (size, padding warnings, which fields each hot method reads) — see Connection hot path → Baseline
      - id: conn-layout
        content: Reorder Http1Connection fields so feed, inputRoom, next and respond read one or two cache lines, cold fields after; clear the widest-first warnings — see Connection hot path → Layout
      - id: conn-work
        content: Remove repeated per-request work in feed, inputRoom and respond that the measurement shows (recomputed caps, cold-field reads, needless memmove of the unread tail) — see Connection hot path → Per-request work
---

# Cheaper HTTP/1.1 requests

## Context

The multicore-server-challenge entry `submissions/nish-std-amritk` serves about 45–57k req/s on 8 vCPUs. A profile of one worker on a Xeon Platinum 8260 VM (Cascade Lake, AVX2 and BMI2, no SHA-NI) attributes user-space CPU as follows: `http1Next` 8.7% (about 5 ns a byte), `sha256Compress` 5.8%, `Http1Connection.inputRoom` 3.6%, `feed` 3.2%, `respond` 3.2%, libc `memmove` about 4%, `Http1Parser.methodIs` 1.2%, `http1WriteResponseHead` 1.1%. The box has to spend about 5% less CPU per request to reach the target.

The parser is [std/net/http1-codec.ts](../../std/net/http1-codec.ts) (`http1Next` at line 1264, `http1TakeLine` 573, `http1FieldLine` 973, `http1RequestLine` 909, `http1IsTokenByte` 648, `http1IsValueByte` 662). The connection is [std/net/http1-server.ts](../../std/net/http1-server.ts) (`Http1Connection` at line 527, `inputRoom` 758, `feed` about 770). Both are inside the scope of [docs/security/http1-codec.md](../../docs/security/http1-codec.md).

The vector byte kernels are in [runtime/runtime-bytes.c](../../runtime/runtime-bytes.c) (`nish_bytes_skip_blank`, `_digits`, `_json_text`, `_json_plain`) and [runtime/runtime-simd.c](../../runtime/runtime-simd.c) (`indexOfAny` on strings, the regex scan). [std/bytes.ts](../../std/bytes.ts) exposes them over `u8[]` as `skipBlank`, `skipDigits`, `skipJsonText`, `skipJsonPlain`, which [src/kernels.ts](../../src/kernels.ts) recognises. None of them stops at the bytes an HTTP line or field value needs.

The workload's request is a keep-alive GET of about 300–400 head bytes in one read: request line, `Host`, `User-Agent`, `Accept`, `Accept-Encoding`, `Authorization: Token <150–200 byte JWT>`. Writes add `Content-Type`, `Content-Length` and a small JSON body.

## Approach

- **Measure first, keep what measures.** Each stage records a baseline before it changes anything, and ships a change only if it is faster outside the noise band, which is measured against a byte-identical copy of the old code. A change inside the noise is dropped and named in the PR body.
- **General, never benchmark-shaped.** No fast path keyed on these headers or this order. The scan and validation changes apply to every line of every head. The field names the parser already special-cases (`content-length`, `transfer-encoding`, `connection`, `host`, `upgrade`, ...) stay the only ones it looks at.
- **Prefer std-only.** A word-at-a-time (SWAR) scan written in Nish over `getU64LE`, or a 256-entry class table, needs no compiler change. A new run kernel in `runtime-bytes.c` (a `skipFieldValue` / `skipToken` pair beside `skipBlank`) is allowed only when the std-only version measurably leaves time on the table. It is a `src/` change: [src/kernels.ts](../../src/kernels.ts) and [src/runtime.ts](../../src/runtime.ts), `npm run build`, the `wasi` and `performance` sections, the `docs/LANGUAGE.md` "Byte runs" rule, the [std/bytes.ts](../../std/bytes.ts) docs and guide page, a `tests/simd/byte-runs.c` case, and the `node tests/run.js budget` runtime size. The PR body says which route was taken and gives the numbers that justified it.
- **Old against new, mechanically.** The differential test compiles a frozen copy of main's parser (renamed, in the test directory) beside the new one and compares them on every input. This is what lets a parser rewrite be merged without anyone trusting the rewrite.
- **The container is not the target CPU.** The cloud container is an Intel Xeon @ 2.1 GHz with AVX2, AVX-512 and SHA-NI. Numbers are taken there, interleaved old/new. Each benchmark prints the CPU model and the SIMD path it took. The Cascade Lake VM is not reachable from the workers. The commands to rerun it there go in [bench/README.md](../../bench/README.md).

## Parser scan

**Owns:** `std/net/http1-codec.ts`, `std/bytes.ts`, `runtime/runtime-bytes.c`, `src/kernels.ts`, `src/runtime.ts`, `src/secret.ts`, `tests/simd/byte-runs.c`, `tests/runtime-budgets.js`, `tests/link/net_http1_parse_diff/**`, `tests/link/net_http1/**`, `tests/fuzz/targets/http1.ts`, `tests/fuzz/regressions/**`, `bench/http1-parse/**`, `bench/README.md`, `docs/BENCHMARKS.md`, `docs/security/http1-codec.md`, `docs/LANGUAGE.md`, `docs/guide/**`, `tests/cases/*bytes*`

### Benchmark

`bench/http1-parse/` holds a Nish program and a `run.mjs` driver. It feeds a parser a fixed set of heads and times `feed` + `next` until `HTTP1_HEAD` (and `HTTP1_END` for a GET), resetting with `restart` between heads as a keep-alive connection does. Two heads:

1. **loadgen**: the six-line GET above with a 180-byte JWT, and its write variant with `Content-Type`, `Content-Length` and a 60-byte JSON body.
2. **browser**: a GET with about 15 fields and realistic lengths: `Host`, `User-Agent` (about 120 bytes), `Accept`, `Accept-Language`, `Accept-Encoding`, `Referer`, `Cookie` (about 300 bytes), `Sec-Fetch-*` ×4, `Sec-CH-UA` ×3, `Upgrade-Insecure-Requests`, `Priority`.

Three builds in one process or three binaries run interleaved: **old** (main's parser copied in), **old′** (a second byte-identical copy, which gives the noise band) and **new**. At least 21 rounds of at least 10^5 heads each, round-robin. The output is the median and min–max of ns per head and ns per byte per build, plus the CPU model.

### Differential test

`tests/link/net_http1_parse_diff/` runs the same input through the frozen old parser and the new one and fails on the first difference. It compares the `next()` result sequence, `status`, `reason`, `method`, `target`, `minor`, every name/value pair, `contentLength`, `keepAlive`, `upgrade`, and the body windows. The inputs:

- the existing corpus in `tests/fuzz/corpus` and `tests/fuzz/regressions`;
- seeded random heads built from a grammar, plus byte-level mutations of valid heads: every byte value 0–255 at every position of a line, bare CR, bare LF, CR not followed by LF, obs-fold, a space before the colon, empty names, a NUL in a value, high-bit bytes, duplicate `Content-Length`, `Transfer-Encoding` + `Content-Length`, a method at `HTTP1_MAX_METHOD` ±1, a target at `maxTarget` ±1, a section at `maxHeaderBytes` ±1, `maxHeaders` ±1;
- every head split at every byte boundary into two `feed` calls, and fed one byte at a time, so the resume-scan path (`p.scan`) is compared too;
- pipelined pairs, to cover `headHeld` and `http1StartRequest`.

It runs at least 10^5 random cases under a fixed seed in `node tests/run.js http1`, and takes a `SEED` / `CASES` override for a long local soak. The PR body states the soak count that was run.

### Baseline

Before editing the parser: run the benchmark (old vs old′ only). `objdump -d` the linked binary's `http1TakeLine`, `http1FieldLine` and `http1RequestLine` inner loops and count instructions per byte. Collect the compiler's `performance:` warnings for `http1-codec.ts`: surviving bounds checks and the "declare the fields widest first" layout warnings. All three go in the PR body as the "before" column.

### Line ends

`http1TakeLine` finds `\n` a byte at a time and checks for a bare CR. Replace that with a scan that tests 8 bytes per step (SWAR has-zero-byte on `x ^ 0x0a0a…` and the CR equivalent) or calls a run kernel, then resolves the exact byte. Keep the behaviour exactly: the limit is checked against the same count, a bare CR is still refused, a line over the limit still answers the same status (414 / 431 / 400) and the same reason, and `HTTP1_NEED_MORE` resumes from `p.scan` without rescanning. Remove the bounds checks that survive in the loop, either by making the range provable to the compiler or by restructuring. Read the compiler's warnings to confirm.

### Span validation

`http1RequestLine` and `http1FieldLine` call `http1IsTokenByte` / `http1IsValueByte` per byte, which compiles to a branch per byte. Validate the name as one token run and the value as one field-value run: either a 256-entry `u8` class table indexed per byte with the error found by a single compare per span, or the run kernel from Line ends. Field-name lowercasing and the OWS trim stay as they are, or fold into the same pass. The first bad byte's position, which decides the reason string, must be the same as before.

### Layout and small paths

Order `Http1Parser` fields so the ones `next()` reads per line (`buf`, `start`, `end`, `scan`, `state`, `lineStart`, `lineEnd`, `sectionBytes`, limits) sit together, then clear the compiler's layout warnings. Look at `http1StartRequest`, which runs per request, at `methodIs` (1.2%), which compares strings where it could compare spans, and at `http1WriteResponseHead` (1.1%). Change each only if measured faster. The `head` copy of each line is the likely source of the `memmove`. Record whether it can be avoided when the whole head is in `buf`. Implement that only if it fits this PR without changing what the span accessors return.

### Record

[docs/security/http1-codec.md](../../docs/security/http1-codec.md) gets a dated entry: what the scan and validation became, why the rules are unchanged, and the differential test as the evidence (its seed, case count and soak count). If a runtime kernel was added, `runtime-bytes.c`'s record scope grows to name it. [docs/BENCHMARKS.md](../../docs/BENCHMARKS.md) gets the ns-per-head table with the box line.

## Connection hot path

**Owns:** `std/net/http1-server.ts`, `bench/http1-conn/**`, `tests/link/net_http1_server/**`, `tests/link/net_http1_server_feed_window/**`, `tests/link/net_http1_server_write_window/**`

Does not touch `std/net/http1-codec.ts` (owned by Parser scan) or any `docs/security/` record. This stage changes no limit, rule or wire behaviour. If a change it wants would need a record entry, it leaves that change out and names it in the PR body.

### Benchmark

`bench/http1-conn/` drives `Http1Connection` without sockets: feed a loadgen-shaped request, `next` to `H1_REQUEST`, `respond` with a small JSON body, consume the output, repeat. Two shapes:

1. one connection, hot in cache;
2. 50,000 connections from one pool, visited round-robin, so each request touches a cold connection object as the 200k-connection box does.

The same old / old′ / new interleaving and output as the parser benchmark. Both builds use main's parser, so this stage's numbers are its own.

### Baseline

Record ns per request for both shapes. Record the size of `Http1Connection` and `Http1Parser` objects, the layout warnings, and, for `feed`, `inputRoom`, `next` and `respond`, the fields each reads. Use `perf stat -e cache-misses` on the cold shape if perf is available in the container, and say so if it is not.

### Layout

Order `Http1Connection` fields hot first: what `inputRoom`, `feed`, `next` and `respond` read on every request goes in the first cache line or two, and config, TLS, WebSocket and pool fields go after. `inputRoom` at 3.6% for trivial code points to a cold line. Check whether it reads a field far from the others, or chases a pointer (pool, config) that could be cached on the connection.

### Per-request work

In `feed` and `respond`: recomputed caps that could be fixed at `acquire`, repeated reads through `this.parser` or a config object, and a `memmove` of the unread tail on every request when nothing is unread. Change each only if it measures faster on the cold shape or the hot shape.

## Out of scope

- `std/crypto/sha256.ts` and the scalar SHA-256 path. Run #1173 (`Feature: sha256-scalar`) owns it and is in flight.
- Kernel TCP time, syscalls and io_uring (run #1084's subject).
- The whole-server run on the Xeon VM at 104.204.68.75. Workers cannot reach it, and changing anything there needs the owner's say. The PRs carry the commands for the owner to run it.
- HTTP/2, HTTP/3, the HTTP/1 client codec, and any change to limits, statuses or reason strings.
- Pipelining-specific optimisation. Pipelined input stays correct and covered by the differential test.

## Tests

- Existing: `node tests/run.js http1` (all `net_http1*` link programs, the codec cases, the fuzz regressions), `node tests/run.js net_http1_server`, the `std_http1_end_head` link test, and the golden cases.
- New: `tests/link/net_http1_parse_diff/` (Parser scan). If a run kernel is added, a `tests/simd/byte-runs.c` case for each kernel against its scalar path on every alignment and length 0–128.
- Generated, regenerated and never hand-edited: `tests/self/goldens/checked/**` (`node tests/self/goldens.js --update`), and `tests/differential/goldens*` and `tests/differential/emit-ts-known.txt` if a positive `tests/cases/*` is added.

## Verification

Per stage, its `verification` line. A change to `src/` also runs `npm run build`, `WASI_SYSROOT=/usr node tests/run.js wasi` (read its skip line) and `node tests/run.js budget`. The full suite is CI's four `test (…, shard N/4)` rows on the PR head.
