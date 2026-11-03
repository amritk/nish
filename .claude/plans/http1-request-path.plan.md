---
name: Cheaper HTTP/1.1 request path
overview: Cut user-space CPU per request on Nish's HTTP/1.1 server — the request parser in std/net/http1-codec.ts first, then the Http1Connection hot path in std/net/http1-server.ts, then (measure-first) the scalar SHA-256 compress — with byte-identical parse results, limits and error messages, proven by an old-vs-new differential test.
stages:
  - id: parser
    title: perf(runtime) — vector line and field scanning in the HTTP/1.1 request parser
    goal: http1Next and its helpers cost measurably fewer ns per head on realistic heads, with identical results on every input
    verification: npm run check && npm run lint && node tests/run.js http1 && node tests/run.js net_http1_parse_diff && node tests/run.js fuzz
    todos:
      - id: parser-baseline
        content: Build the micro-benchmark bench/http1-parse.ts and record the baseline ns per head and instructions per byte of http1Next on main — see Parser
        status: pending
      - id: parser-oracle
        content: Freeze the current parser as a test-only oracle and add the old-vs-new differential link test tests/link/net_http1_parse_diff — see Parser
        status: pending
      - id: parser-scan
        content: Rewrite the line-end and token/value validation in http1TakeLine, http1RequestLine and http1FieldLine to scan a vector at a time and not re-scan bytes — see Parser
        status: pending
      - id: parser-layout
        content: Reorder Http1Parser fields hot-first and widest-first, and trim methodIs and http1WriteResponseHead per-call work — see Parser
        status: pending
      - id: parser-record
        content: Update docs/security/http1-codec.md (scope unchanged, a dated review note naming the differential test) and regenerate goldens — see Parser
        status: pending
  - id: connection
    title: perf(runtime) — keep Http1Connection's per-request work on hot fields
    goal: Http1Connection.inputRoom, feed and respond touch fewer cache lines per request, measured on bench/http1-server.ts
    verification: npm run check && npm run lint && node tests/run.js net_http1_server && node tests/run.js http1
    todos:
      - id: conn-baseline
        content: Measure bench/http1-server.ts baseline (ns per request, perf stat cache misses where available) on main — see Connection
        status: pending
      - id: conn-layout
        content: Reorder Http1Connection fields so the per-request ones share the first cache lines, fix every widest-first warning, and remove per-request reads of cold fields in inputRoom, feed and respond — see Connection
        status: pending
      - id: conn-goldens
        content: Regenerate tests/self/goldens/checked and the layout pins that move with the struct — see Connection
        status: pending
  - id: sha256
    title: perf(runtime) — close the scalar SHA-256 compress gap, if it is worth closing
    goal: Know the gap between nish's scalar sha256Compress and a good scalar C implementation, and close it only if it is at least 10 percent
    verification: npm run check && npm run lint && node tests/run.js sha256 && node tests/run.js crypto_hmac_sha256
    todos:
      - id: sha-measure
        content: Measure nish scalar sha256Compress (SHA-NI path disabled) against a scalar C twin in bench/sha256 on the same CPU — see SHA-256
        status: pending
      - id: sha-decide
        content: Under 10 percent gap, open a draft PR with only the measurement and stop; at or over, optimise std/crypto/sha256.ts scalar compress — see SHA-256
        status: pending
---

## Context

The motivating workload is an HTTP/1.1 server at ~45–57k req/s on 8 vCPUs (Xeon Platinum 8260, Cascade Lake: AVX2/BMI2, no SHA-NI). User-space profile of one worker: `http1Next` 8.7% (~5 ns/byte), `sha256Compress` 5.8%, `Http1Connection.inputRoom` 3.6%, `feed` 3.2%, `respond` 3.2%, memmove ~4%, `Http1Parser.methodIs` 1.2%, `http1WriteResponseHead` 1.1%. The box needs ~5% less CPU per request; every 1% counts.

Typical request (keep-alive, never pipelined, one read, 300–400 byte head):

```
GET /api/articles?limit=10&offset=0 HTTP/1.1\r\n
Host: 104.204.68.75\r\n
User-Agent: conduit-loadgen/1\r\n
Accept: application/json\r\n
Accept-Encoding: gzip\r\n
Authorization: Token <150-200 byte JWT>\r\n
\r\n
```

[std/net/http1-codec.ts](std/net/http1-codec.ts) already loads 16 bytes at a time in `http1TakeLine` (SWAR control-byte test over two u64 halves, then a byte loop). What it does per byte after that, and in `http1FieldLine`/`http1RequestLine`, is the target.

## Approach

- **Real-world only.** No fast path keyed on specific header names, values or this load generator. Anything that wins must win for any Nish HTTP/1.1 server.
- **Correctness first.** The parser is security-relevant (smuggling, 400/414/431, header limits). Every limit, status and error message stays byte-identical. The proof is a differential test against a frozen copy of today's parser.
- **Measured.** Use a micro-benchmark with ns per head, the median of many interleaved old/new rounds, and the noise band reported. Count instructions per byte from `objdump` of the hot loop, before and after. A change inside the noise band is reported as such and not claimed.
- **std/ only by default.** A `src/` change (a compiler improvement the parser needs) is out of these stages: report it as a follow-up and do not make it. `runtime/runtime-simd.c` may be *used* through existing builtins (`nish:simd`, `std/bytes`) but not extended.
- **Whole-server number.** The Xeon VM is not reachable from cloud sessions. Workers report container-local numbers only, on an Intel Xeon with AVX2, BMI2 and SHA-NI. The whole-server check is left for a human.

## Parser

Owns: `std/net/http1-codec.ts`, `bench/http1-parse.ts`, `bench/http1-parse/**`, `tests/link/net_http1_parse_diff/**`, `tests/fuzz/corpus/http1/**`, `docs/security/http1-codec.md`, `tests/self/goldens/checked/**` (regenerated only), `tests/differential/**` goldens (regenerated only).

- **Benchmark** `bench/http1-parse.ts`. Heads: (a) the loadgen shape above with a 180-byte token, (b) a write of the same shape plus Content-Type, Content-Length and a small body, (c) a browser-like head with ~15 fields (Cookie, Accept-Language, Sec-Fetch-*, a long User-Agent). Report ns per head and ns per byte, as the median of ≥31 interleaved rounds of old (the oracle copy) vs new in the same binary, with min/max as the noise band.
- **Oracle.** Copy today's parser to `tests/link/net_http1_parse_diff/old-codec.ts`, renamed, unmodified otherwise. The test drives both with (1) the existing fuzz corpus, (2) seeded random heads drawn from a grammar that includes every refusal class (bare LF, CR without LF, control and DEL bytes in names and values, obs-fold, obs-text, a space before the colon, a duplicate or conflicting Content-Length, TE plus CL, over-long target, method, line and section, too many fields, an empty name, NUL), (3) every head split at every byte boundary and fed in 1–3 pieces. Compare the event sequence, the status, every span (method, target, version, each name and value), body framing and `buffered`. Expected stdout is a pass count, and any divergence prints the seed and input. The test is deterministic.
- **Scan.** Find CR/LF and validate in one pass a vector at a time. `http1FieldLine` should take the colon position and the "has control" or "has bad token byte" verdict from the scan rather than walking the bytes again. Use a table or vector check for token bytes (tchar) over the whole name span. When a head arrives in one read, no byte is visited twice. `p.scan` already resumes partial lines; keep that behaviour. Check the IR and the asm: objdump the loop, count instructions per byte, and clear every `performance:` warning the compiler prints for the file.
- **Layout and small fns.** Order Http1Parser fields hot first, then widest first (the compiler's warnings). `methodIs` and `http1WriteResponseHead` should do no per-call work that can be hoisted or done once per head.
- **Record.** Add a dated note in [docs/security/http1-codec.md](docs/security/http1-codec.md) that says what changed and names the differential test. Scope and findings are unchanged unless the work finds a bug; a bug found is fixed with a before/after test and recorded.

## Connection

Owns: `std/net/http1-server.ts`, `bench/http1-server.ts`, `tests/self/goldens/checked/**` (regenerated only). Does **not** edit `docs/security/http1-codec.md` (the parser stage owns it). A security-relevant observation goes in the PR body for the lead.

- `inputRoom` at 3.6% for trivial code points to cache misses on a cold connection object (~200k keep-alive connections per box). Map which fields `inputRoom`, `feed`, `respond` and `next` read per request. Put them together at the head of the class, widest first, and put cold state (TLS, WebSocket, compression, config) after them. Where a per-request read of a cold field can be replaced by a hot copy or by a value from the server, do that.
- Measure with `bench/http1-server.ts`, plus `perf stat -e cache-misses,instructions` where it is available. Report ns per request old vs new, median of interleaved runs. Behaviour is unchanged, and `tests/link/net_http1_server` and all `net_http1_server_*` tests pass.

## SHA-256

Owns: `std/crypto/sha256.ts`, `bench/sha256/**`, `docs/security/crypto-sha256-hw.md`, `tests/self/goldens/checked/**` (regenerated only).

- This container's CPU has SHA-NI, so measure with the hardware path disabled (find the existing pin or switch in `runtime/runtime-sha256.c`; do not add one in `runtime/`). Compare against a scalar C twin of Linux's `sha256_transform` or OpenSSL's `sha256_block_data_order` C fallback. Take care with licences: write it from the FIPS 180-4 spec or follow [.claude/licensing.md](.claude/licensing.md).
- If the gap is under 10%, open a **draft** PR holding only the bench twin and the numbers, titled `test(runtime): measure scalar SHA-256 against a C twin`, and stop. If the gap is 10% or more, optimise the scalar compress in `std/crypto/sha256.ts`, keeping the `Secret`/wipe rules, and run all `crypto_sha*` and `crypto_hmac*` tests.

## Out of scope

- `src/` (no compiler changes), `runtime/*.c` edits, the TLS path, HTTP/2 and HTTP/3, the client codec.
- Any deployment or change on the Xeon VM.
- A fast path for particular header names or values.

## Tests

The new `tests/link/net_http1_parse_diff` is described under Parser. The existing tests that must stay green are `net_http1*`, `net_http1_server*`, `std_http1_*`, the http1 fuzz corpus, the golden cases, and `crypto_sha*`/`crypto_hmac*` for the SHA stage.

## Verification

Each stage runs its `verification` line and `node tests/self/goldens.js --update` (the diff is read). CI's four test shards must be green on the head, with skip counts read per AGENTS.md "Trusting a test run".
