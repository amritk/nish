---
name: Standard-library micro-benchmarks, then cut their cost
overview: A real HTTP/Postgres server in Nish spends about 2x the user-space CPU of a comparable Rust server, spread over many small costs in nish/net/http1, JWT verification (SHA-256, base64url), nish/net/postgres and the runtime's copies and checks. Add one repeatable micro-benchmark per category under bench/, then ship each repeatable gain as its own PR, with general compiler and stdlib fixes preferred over workload tuning.
stages:
  - id: http1-path
    title: "perf(net): benchmark the HTTP/1.1 request path and cut its largest cost"
    goal: A bench that times feed → next → respond on realistic request heads and JSON bodies in ns/op and instructions, plus the single largest repeatable cut in http1-codec or http1-server
    verification: npm run check && npm run lint && node tests/run.js http1 && node bench/http1-request/run.mjs --validate
    status: pending
    todos:
      - id: http1-bench
        content: Add bench/http1-request/ (main.ts, run.mjs, README.md) driving Http1Connection over the corpus in Inputs — see Measurement protocol and HTTP request path
      - id: http1-inspect
        content: Read the -O2 IR and asm of http1Next, inputRoom, feed, respond, http1TakeLine, http1WriteResponseHead, park, http1HeadAppend and methodIs, and rank the costs in the bench README — see HTTP request path
      - id: http1-cut
        content: Ship the largest repeatable cut, with tests for every edge it touches — see HTTP request path
  - id: jwt-decode
    title: "perf(crypto): benchmark HS256 verification and cut base64url decode"
    goal: A bench for a whole HS256 verify and for base64url decode of real token segments, and a faster std base64url decode that a caller-owned-buffer JWT check can use instead of its own decoder
    verification: npm run check && npm run lint && node tests/run.js base64 && node tests/run.js jwt && node tests/run.js hmac && node bench/jwt-verify/run.mjs --validate && node scripts/security-scope.mjs
    status: pending
    todos:
      - id: jwt-bench
        content: Add bench/jwt-verify/ timing JwtVerifier.verify, the hmacCopySha256 midstate verify on a 104-byte signing input, and base64url decode of each segment — see Measurement protocol and JWT and base64url
      - id: jwt-decode-cut
        content: Speed up std base64url decode (std/crypto/base64url.ts, and std/base64.ts if it shares the loop) for the cause the IR names — see JWT and base64url
      - id: jwt-decode-into
        content: Decide, with numbers, whether a decode into a caller-owned buffer belongs in std; add it only if it is general — see JWT and base64url
  - id: sha256-avx2
    title: "perf(runtime): SHA-256 message schedule on AVX2 for CPUs without SHA-NI"
    goal: On x86-64 with AVX2 and no SHA-NI, sha256Compress runs a C kernel that vectorises the message schedule, selected once per process, with the Nish body as the fallback and an override that forces each path
    verification: npm run check && npm run lint && node tests/run.js sha256 && node tests/run.js hmac && node tests/run.js jwt && node tests/run.js wasi && node tests/run.js performance && node bench/sha256-block/run.mjs --validate && node scripts/security-scope.mjs
    status: pending
    todos:
      - id: sha-measure
        content: Re-run bench/sha256-block with a new avx2 column and record ns and cycles per block for soft, avx2, SHA-NI and OpenSSL — see SHA-256 on AVX2
      - id: sha-kernel
        content: Add the AVX2 schedule kernel to runtime/runtime-sha256.c behind the existing chooser, with NISH_SHA256 accepting the new value — see SHA-256 on AVX2
      - id: sha-tests
        content: Run NIST, RFC 4231 and the OpenSSL differential under every NISH_SHA256 value, and update the hardware record — see SHA-256 on AVX2
  - id: pg-decode
    title: "perf(net): benchmark Postgres DataRow decoding and cut its largest cost"
    goal: An offline bench that feeds recorded DataRow streams through PgConnection and the array walker in ns/row and instructions, plus the largest repeatable cut in postgres.ts or bytes.ts
    verification: npm run check && npm run lint && node tests/run.js postgres && node tests/run.js bytes && node bench/pg-decode/run.mjs --validate
    status: pending
    todos:
      - id: pg-bench
        content: Add bench/pg-decode/ feeding canned backend bytes through PgConnection.readRow, arrayElement, PgPool.next and putDecimal with no server — see Measurement protocol and Postgres decode
      - id: pg-inspect
        content: Read the IR of readRow, arrayElement, PgArrayWalker.next, putDecimal and getI64BE and rank the costs in the bench README — see Postgres decode
      - id: pg-cut
        content: Ship the largest repeatable cut, with tests for every edge it touches — see Postgres decode
  - id: copies-checks
    title: "perf(codegen): find what calls memcpy and the bounds checks in hot loops, cut the largest"
    goal: Attribute the server's unknown memcpy-like frames and nish_plain_base time to their callers, measure array growth and bounds-check cost in the four benches, and ship the largest general compiler or runtime fix
    verification: npm run check && npm run lint && node tests/run.js self && node tests/run.js wasi && node tests/run.js performance && node tests/run.js json && node bench/runtime-copies/run.mjs --validate
    status: pending
    todos:
      - id: copies-attribute
        content: Profile the four benches and bench/http1-server.ts under callgrind and name every memcpy, memmove and nish_plain_base caller, with sizes — see Copies and checks
      - id: copies-bench
        content: Add bench/runtime-copies/ for the shapes found (small fixed copies, array growth, bounds-checked loops, JsonWriter strings) — see Copies and checks
      - id: copies-cut
        content: Ship the largest general cut in src/ or runtime/, with IR and native tests — see Copies and checks
      - id: copies-index
        content: Add one bench/README.md section that indexes the five new benches — see Copies and checks
  - id: http1-path-2
    title: "perf(net): the next HTTP/1.1 request-path cut"
    goal: The next-ranked HTTP cut from http1-path's README, shipped if it repeats above the noise, or recorded as measured and not built
    verification: npm run check && npm run lint && node tests/run.js http1 && node bench/http1-request/run.mjs --validate
    status: pending
    todos:
      - id: http1-cut-2
        content: Take the next candidate from bench/http1-request/README.md, measure it, then ship it or record it as dropped — see Second cuts
  - id: pg-decode-2
    title: "perf(net): the next Postgres decode cut"
    goal: The next-ranked Postgres cut from pg-decode's README, shipped if it repeats above the noise, or recorded as measured and not built
    verification: npm run check && npm run lint && node tests/run.js postgres && node tests/run.js bytes && node bench/pg-decode/run.mjs --validate
    status: pending
    todos:
      - id: pg-cut-2
        content: Take the next candidate from bench/pg-decode/README.md, measure it, then ship it or record it as dropped — see Second cuts
  - id: copies-checks-2
    title: "perf(codegen): the next copy or bounds-check cut"
    goal: The next-ranked general compiler or runtime cut from copies-checks' README, shipped if it repeats above the noise, or recorded as measured and not built
    verification: npm run check && npm run lint && node tests/run.js self && node tests/run.js wasi && node tests/run.js performance && node bench/runtime-copies/run.mjs --validate
    status: pending
    todos:
      - id: copies-cut-2
        content: Take the next candidate from bench/runtime-copies/README.md, measure it, then ship it or record it as dropped — see Second cuts
---

# Standard-library micro-benchmarks, then cut their cost

## Context

The server is `submissions/nish-std-amritk` in `arjaythedev/multicore-server-challenge`, built with Nish 0.34.0 at `--cpu x86-64-v3`. On a Xeon Platinum 8260 VM (no SHA-NI) at 47,000 req/s it spends about 18 µs per request in user space. The Nish-owned parts are listed below in µs per request. You may read that submission to see how it calls Nish. Do not build or run any other entrant's code.

| Category | Frames (µs/request) |
| --- | --- |
| HTTP | http1Next 1.05, Http1Connection.inputRoom 0.41, .feed 0.35, .respond 0.34, http1TakeLine 0.34, http1WriteResponseHead 0.21, .park 0.19, http1HeadAppend 0.18, Http1Parser.methodIs 0.12, Http1Server.next 0.09 |
| JWT | sha256Compress 0.84, Sha256.update 0.13, the server's own jwtDecode 0.55 (a byte-at-a-time base64url decode in its `src/jwt.ts`) |
| Postgres | PgConnection.readRow 0.22, arrayElement 0.20, PgPool.next 0.13, putDecimal 0.12, getI64BE 0.07, binary array decoding |
| Runtime | nish_plain_base 0.23, about 2.4 of `[unknown]` frames, probably libc memcpy-type calls; array growth and bounds checks in hot loops |

**This work is already done, so do not redo it:**
- #1179 scanned request heads a vector at a time.
- #1176 put the hot fields first.
- #1139 and #1146 cut parse and Date-header cost.
- #1174 measured the scalar SHA-256 block at 208-218 ns against OpenSSL's 174-183 scalar, 148-151 AVX2 and SHA-NI 47-49. Its best source rewrite gained only 8-9.4%, and module-level constant arrays are refused.
- `feature/http1-request-path/sha256` found the portable body within 3-9% of a C twin.

Scalar source rewrites of `sha256Compress` are therefore out. **bcrypt is out of scope**: another worker owns it.

## Measurement protocol (every stage)

- **Layout:** one directory per bench, `bench/<name>/` with `main.ts`, `run.mjs` and `README.md`, built on the [bench/sha256/run.mjs](bench/sha256/run.mjs) and [bench/http1-parse/run.mjs](bench/http1-parse/run.mjs) pattern.
- **Timing:** `--profile speed`, with a calibrated iteration count. Each run includes a byte-identical copy column; its gap to the build is the noise band. Rounds are interleaved with `roundOrder` from [bench/json-compare/rounds.mjs](bench/json-compare/rounds.mjs), 11 by default. Every case has a pinned checksum, and `--validate` checks checksums only. `--binary name=<path>` and a `--base <rev>` freeze give a before column.
- **What to report:** ns/op as the median of the interleaved rounds, with the min-max spread of the build and of its copy.
- **Instruction counts:** `perf` is not installed in these containers, so use `valgrind --tool=callgrind` (or cachegrind with `--cache-sim=no`). When the timing band is wider than the effect, rank changes by instructions. Report cycles only where something measures them (`rdtsc` as in [bench/sha256-block/tsc.c](bench/sha256-block/tsc.c)).
- **Machine stamp:** every result names the CPU model and its relevant flags (`avx2`, `bmi2`, `sha_ni`, `avx512f`) from `/proc/cpuinfo`. The cloud CPU has SHA-NI and AVX-512 and the Xeon 8260 has neither, so force `NISH_SHA256=soft` where the server's path matters.
- **Targets:** measure both `--cpu x86-64` (the baseline) and `--cpu x86-64-v3`, which the server builds with.
- **Gain rule:** a gain counts only if it repeats outside the band on two separate runs. Anything inside the band is dropped and recorded in the bench README under "Tried and dropped". CPU pinning is never a justification: the server cannot pin.
- **PR body:** before, after, spread and instruction counts, plus a `Measured:` trailer (`.claude/testing.md` → "A `Measured:` trailer"). One idea per PR.

## Inputs

- **HTTP heads:** browser-shaped (GET, 600-800 B: Accept, Accept-Language, User-Agent, Cookie, `Authorization: Bearer <~250-byte HS256 JWT>`), API-client-shaped (POST, 200-350 B with Bearer JWT, Content-Type and Content-Length, JSON body), and short heads (`GET / HTTP/1.1` plus Host, under 64 B). Include pipelined pairs and a head split across two feeds.
- **Responses:** JSON bodies of 1, 4, 16 and 40 KiB, written through `JsonWriter` the way the server's `json-out.ts` does, and sent through `respond`.
- **JWT:** tokens the server issues (`{"alg":"HS256","typ":"JWT"}` header, payload with sub, iat, exp and a role, 104-byte signing input), plus a 300-byte payload case.
- **Postgres:** DataRow streams with columns int8, text (8-64 B), timestamptz, and binary int8[] arrays of 0, 1, 4 and 8 elements, including NULL columns. Rows come in batches of 1, 20 and 100 with the RowDescription, CommandComplete and ReadyForQuery messages around them, in the text and binary formats the server uses (`PG_BATCH_TEXT`).

## HTTP request path

- **Files:** [std/net/http1-codec.ts](std/net/http1-codec.ts) (`http1Next` :1304, `http1TakeLine` :586, `http1HeadAppend` :754, `methodIs` :341, `http1WriteResponseHead` :1699) and [std/net/http1-server.ts](std/net/http1-server.ts) (`Http1Connection` :527, `park` :725, `inputRoom` :770, `feed` :791, `respond` :1139).
- **Bench:** `bench/http1-request` drives `Http1Connection` with no socket, as [bench/http1-conn](bench/http1-conn/README.md) does. Extend http1-conn instead if that is cleaner, and say why.
- **What to look for:** redundant bounds checks, length reloads per byte, small helpers left out of line, per-request allocation, byte-at-a-time loops the #1179 vector scan does not cover, and copies of the head or body that could be views.
- **Ranking:** write the ranked list of candidates, with an instruction estimate for each, into the bench README. http1-path-2 takes the next one from it.
- **Limits:** every parsing limit, over-limit status and rejection of malformed input stays identical. The existing `net_http1*` tests and `net_http1_parse_diff` must pass unchanged.
- **Fast-path tests:** a new fast path needs tests with input ending exactly at the buffer's end, one byte short, and the delimiter as the last byte.

## JWT and base64url

- **Files:** [std/crypto/base64url.ts](std/crypto/base64url.ts) (`base64urlDecode` :133, which returns `u8[] | null`, and the sextet helpers :47-72), [std/crypto/jwt.ts](std/crypto/jwt.ts) and [std/base64.ts](std/base64.ts).
- **Measure first:** the server's `jwtDecode` (byte-at-a-time with an if-chain sextet), std's decode, and whether a 4-characters-to-3-bytes loop with a branch-free sextet beats both. Make no secret-dependent table lookups if the decoder can see key material; check the [docs/security/crypto-k1.md](docs/security/crypto-k1.md) record for what it promises.
- **Decode into a caller-owned buffer:** add one to std only if it is general, meaning std/base64 and JwtVerifier would use it too. Otherwise list "use std's decoder" as a server-side change.
- **Must not change:** the constant-time signature comparison (`timingSafeEqualAt`), and rejection of non-canonical trailing bits, `len % 4 === 1`, and bytes outside the alphabet.
- **Tests:** the existing `crypto_base64url*`, `std_base64*` and `crypto_jwt*` tests, plus new tests at segment lengths 0-7 (mod 4) and output buffers sized exactly or one byte short.
- **Records:** update `crypto-k1.md` and `crypto-jwt.md`. The guide page `docs/guide/using-nish/auth.md` or `standard-library.md` changes only if the API does.

## SHA-256 on AVX2

- **Pattern:** `runtime/runtime-sha256.c` already has a chooser (SHA-NI on x86-64, SHA2 on AArch64, and `NISH_SHA256=soft`), lowered through `isSha256Seam` in [src/kernels.ts](src/kernels.ts).
- **New path:** for x86-64 with AVX2 (XCR0 checked) and no SHA-NI, add a kernel that computes the message schedule with AVX2 (Intel's "fast SHA-256" / OpenSSL `sha256_block_data_order_avx2` approach) and keeps the rounds scalar. Write it from FIPS 180-4 with intrinsics, compiled per function with `__attribute__((target("avx2,bmi2")))` so the baseline runtime still builds for x86-64. If code is ported, follow [.claude/licensing.md](.claude/licensing.md).
- **Override:** `NISH_SHA256` gains a value that forces this path, and `soft` still forces Nish.
- **Bar:** the target is OpenSSL's AVX2 figure. Ship only if it beats the soft body by more than 10% outside the band; otherwise record it as measured and not built in [bench/sha256-block/README.md](bench/sha256-block/README.md).
- **No compiler change:** `src/` stays untouched; the seam already exists.
- **Tests:** NIST vectors, RFC 4231 HMAC, and the OpenSSL differential at random lengths 0-1000 under every `NISH_SHA256` value, including inputs that end at the end of the state and message arrays. Update `docs/security/crypto-sha256-hw.md` (scope and findings) and its index row, and the `NISH_SHA256` lines in `docs/INSTALL.md` and `std/README.md`.

## Postgres decode

- **Files:** [std/net/postgres.ts](std/net/postgres.ts) (`PgConnection` :1194, `readRow` :1634, `putDecimal` :2276, `arrayElement` :2500, `PgArrayWalker` :1058, `PgPool` :2929), [std/net/postgres-carrier.ts](std/net/postgres-carrier.ts) and [std/bytes.ts](std/bytes.ts) (`getI64BE` :113, which goes through `getU64BE`).
- **Bench:** `bench/pg-decode` replays canned backend bytes, captured once or built by hand from the protocol, through the connection's receive path with no server. If the class needs a socket, use the replay seam that `tests/link/std_postgres_replay` uses.
- **What to look for:** byte-assembled big-endian loads that should be one `bswap`, per-row allocation, re-scanning column lengths, and bounds checks the walker could prove once per message.
- **Ranking:** write the ranked candidate list into the bench README.
- **Tests:** truncated messages and arrays whose last element ends at the buffer's end, against the existing `std_postgres*` panic tests. Update `docs/security/postgres.md` and `docs/security/bytes.md` when their files change.

## Copies and checks

- **Attribute first:** run callgrind over the four new benches and `bench/http1-server.ts`, then name every `memcpy`, `memmove` and `nish_plain_base` caller with its size distribution. Find out whether small fixed-size copies lower to a libc call, which can happen at `-O2` when the size is not a constant or after `--profile speed` LTO decisions.
- **Where copies come from:** [src/emit-arrays.ts](src/emit-arrays.ts) (`MEMCPY` :87, slices :502, records :929, join and concat :1531-1608, `set` and `copyWithin` :1655), `nish_array_grow` in [runtime/runtime.c](runtime/runtime.c) :1479, `copyBytes` in [std/bytes.ts](std/bytes.ts) :281 (read-only for this stage; pg-decode owns it), and `JsonWriter` in [std/json.ts](std/json.ts) feeding `nish_plain_base` in [runtime/runtime-bytes.c](runtime/runtime-bytes.c).
- **Bench:** `bench/runtime-copies` reproduces each shape found.
- **What to fix:** prefer a general fix that helps every program, for example inline small constant copies, a growth policy that avoids repeated regrowth, a bounds check hoisted where the checker can already prove the range, or a JSON plain-run scan that does not re-enter for short strings.
- **Compiler rules:** a `src/` change follows [.claude/selfhost.md](.claude/selfhost.md) and the rolling freeze. It ships IR tests (`tests/cases`) and native tests (it does not edit `tests/run.js`, which sha256-avx2 owns), regenerates the goldens, and runs `wasi` and `performance`. If counts move, update `bench/instructions.json` with `node bench/run.mjs --instructions --update` and give the reason.
- **Bench index:** the stage also owns `bench/README.md` and adds one section indexing the five new benches.

## Second cuts

http1-path-2, pg-decode-2 and copies-checks-2 each take the next candidate from their category's README ranking, at the then-current `main`.

- **Outcome:** either a perf PR, or a PR that only updates the README's "Tried and dropped" table with the numbers (a `docs(...)` or `test(...)` subject, on the precedent of #1151 "measured, not built").
- **Stopping rule:** a category stops when its next candidate is below the noise.

## Ownership

Generated files, never hand-edited: `tests/self/goldens/checked/**`, `tests/differential/goldens*`, `tests/differential/emit-ts-known.txt` (only under CI's Node version), `bench/instructions.json` (via `--update`), `docs/BENCHMARKS.md`.

| Stage | Owns |
| --- | --- |
| http1-path, http1-path-2 | `bench/http1-request/**`, `bench/http1-conn/**`, `std/net/http1-codec.ts`, `std/net/http1-server.ts`, `docs/security/http1-codec.md`, `tests/link/net_http1*/**`, `tests/link/std_http1*/**` |
| jwt-decode | `bench/jwt-verify/**`, `std/crypto/base64url.ts`, `std/crypto/jwt.ts`, `std/base64.ts`, `docs/security/crypto-k1.md`, `docs/security/crypto-jwt.md`, `tests/link/crypto_base64url*/**`, `tests/link/crypto_jwt*/**`, `tests/link/std_base64*/**`, `docs/guide/using-nish/auth.md`, `docs/guide/using-nish/standard-library.md` |
| sha256-avx2 | `runtime/runtime-sha256.c`, `bench/sha256-block/**`, `bench/sha256/**`, `docs/security/crypto-sha256-hw.md`, `docs/security/README.md`, `tests/link/sha256_hw*/**`, `tests/link/crypto_sha256*/**`, `tests/simd/sha256.c`, `tests/run.js`, `docs/INSTALL.md`, `std/README.md` |
| pg-decode, pg-decode-2 | `bench/pg-decode/**`, `std/net/postgres.ts`, `std/net/postgres-carrier.ts`, `std/bytes.ts`, `docs/security/postgres.md`, `docs/security/bytes.md`, `tests/link/std_postgres*/**`, `tests/link/std_bytes*/**`, `tests/postgres/**` |
| copies-checks, copies-checks-2 | `src/**`, `runtime/runtime.c`, `runtime/runtime-bytes.c`, `runtime/runtime-simd.c`, `runtime/nish.h`, `std/json.ts`, `bench/runtime-copies/**`, `bench/README.md`, `tests/cases/**`, `tests/ir/**`, `tests/link/std_json*/**`, `tests/perf-baseline.json`, `docs/IR_COOKBOOK.md`, `docs/security/runtime.md`, `docs/security/codegen.md`, `docs/security/json.md` |

- **Merge order:** copies-checks merges after the four bench stages (its README index names them). Each `-2` stage starts only after its first stage merges.
- **Starting order:** the first four run at once; copies-checks starts when a slot frees.

## Out of scope

- bcrypt.
- Scalar rewrites of `sha256Compress`.
- CPU pinning.
- CI workflow edits.
- Any API that only this server would use.
- Server-side changes: these are listed in the final report instead.
- The release itself: the Release PR is never merged by the run.
