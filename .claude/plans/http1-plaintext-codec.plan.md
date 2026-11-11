---
name: HTTP/1 plaintext codec — cut the explicit TFB entry's instructions per request
overview: Make the explicit TechEmpower entry (bench/techempower/main.ts + server.ts on Http1Server) faster on /plaintext by cutting the HTTP/1 codec's user-space instructions per request — the request parser (53% of 5,419 Ir) and the response-head writer (28%) — so its median at 256 and 1,024 connections reaches go-fasthttp's on the same machine, with the gap to uWS reported with its band. Every byte the server answers, its limits and its error answers stay as they are; the parser change is proven by a differential test against the frozen old parser. The gains must hold for real traffic, not only for TFB's request: every stage also measures bench/http1-request (browser, API, short, split and pipelined heads, JSON bodies of 1k–40k) and a non-pipelined wrk run with a browser-shaped head, and no code path is keyed on the benchmark's route, header set or request bytes.
stages:
  - id: baseline
    title: "docs(runtime): profile the explicit TFB entry against uWS and go-fasthttp on plaintext and json"
    goal: docs/BENCHMARKS.md records, on main after #1407's fix-serve, the explicit entry's Ir per request and top user-space frames on /plaintext and /json (profile.sh), and run.sh medians with the entry vs entry-copy band for the explicit entry, the async entry, uWS and go-fasthttp on /plaintext at 256 and 1,024 connections and /json — the baseline every fix stage and the regate compare against.
    verification: npm run lint && node docs/check-links.mjs && bash -n bench/techempower/profile.sh && bash bench/techempower/profile.sh --only plaintext && bash bench/techempower/run.sh (plaintext and json rows, entry, async, uws, go-fasthttp) && node bench/http1-request/run.mjs --validate && node bench/http1-request/run.mjs --instructions && node bench/http1-parse/run.mjs
    status: pending
    todos:
      - id: baseline-tools
        content: Install wrk and build the uws and go-fasthttp twins per bench/techempower/README.md and bench/http-twins/README.md; get profile.sh's tools working (valgrind present; no perf from apt, so use profile.sh's documented fallback) — say in the doc which tool each figure comes from
        status: pending
      - id: baseline-profile
        content: Run profile.sh on /plaintext (c=256, 16 pipelined) and /json for the explicit entry, in the foreground; list Ir per request, syscalls per request and the top-20 frames by self Ir, grouped into parse (http1Next, http1TakeLine, ...), head write (http1WriteResponseHead and its Put* helpers), loop/IO and other
        status: pending
      - id: baseline-run
        content: Run run.sh in the foreground, interleaved, entry vs entry-copy band, on /plaintext at 256 and 1,024 connections and /json at the concurrencies run.sh uses, for the explicit entry, the async entry, uws and go-fasthttp; record medians, the band and RSS
        status: pending
      - id: baseline-real
        content: Take the real-world baseline on the same machine — `node bench/http1-request/run.mjs` (time, 11+ rounds) and `--instructions` (Ir per case), `node bench/http1-parse/run.mjs`, and a non-pipelined wrk run on the explicit entry's /plaintext and /json at c=256 with a browser-shaped head (User-Agent, Accept, Accept-Language, Accept-Encoding, a ~200-byte Cookie, ~750 bytes in all, sent with wrk -H). Add to bench/http1-request a `varied` case whose responses alternate status, fields and body length every request, so a head-reuse miss is measured, and pin its checksum
        status: pending
      - id: baseline-publish
        content: Add a "HTTP/1 codec baseline" section to docs/BENCHMARKS.md with the tables and exact commands, the real-world table (http1-request ns and Ir per case, http1-parse, the browser-head wrk runs), and the ranked per-frame targets for the codec and head stages; a harness bug found in run.sh or profile.sh is fixed here and said so in the PR (a missing twin or a profile.sh change goes in the README too)
        status: pending
  - id: codec
    title: "perf(net): parse an HTTP/1 request head a vector at a time and write the response head in bulk"
    goal: profile.sh shows the explicit entry's parse frames (http1Next, http1TakeLine and their helpers) on /plaintext cut by at least half of the baseline's ~2,850 Ir per request, and the writer's byte loops replaced with bulk copies, with the new parser agreeing with the frozen old one on every input the differential test feeds it.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js net_http1 && node tests/run.js net_http1_parse_diff && node tests/run.js std_http1 && node tests/run.js net_serve && node tests/run.js tfb_entry && node tests/run.js tfb_async_entry && node tests/run.js fuzz && node tests/run.js simd && node bench/http1-request/run.mjs --validate && node bench/http1-request/run.mjs --instructions --base <main> && node bench/http1-parse/run.mjs && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && bash scripts/fetch-seed.sh --force && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && bash bench/techempower/profile.sh --only plaintext (before on main, after on the branch) && bash bench/techempower/run.sh (plaintext and json rows)
    status: pending
    todos:
      - id: codec-freeze
        content: Before changing the parser, refreeze tests/link/net_http1_parse_diff/old.ts to main's http1-codec.ts parser at this stage's base (it exists already as the differential harness; check it is current), so the differential compares the new parser against the one it replaces
        status: pending
      - id: codec-scan
        content: Find CR/LF, header-line and name/value boundaries a vector or word at a time in http1TakeLine, http1FieldLine, http1RequestLine and http1Next (extend the existing u8x16 paths from nish:simd; SWAR where a vector does not fit), and stop copying or re-scanning the bytes of fields the server does not need, keeping every limit, every rejection (bare CR, bare LF, obs-fold, control and high-bit bytes, token rules) and every span callers read
        status: pending
      - id: codec-writer
        content: Replace the byte loops in http1PutBytes, http1PutCrlf, http1PutDecimal, http1PutStatusLine and http1WriteResponseHead with bulk copies (or fixed vector stores, as http1PutFixed already does), output byte for byte as before
        status: pending
      - id: codec-diff
        content: Extend net_http1_parse_diff so new and old agree (accept or reject, same status, same spans) on the fuzz corpus and regressions, random heads and malformed heads aimed at the new scan (a CR or LF at every lane of a vector, boundaries at every split point, heads exactly at each limit); keep every net_http1_* test and the fuzz targets' replays green
        status: pending
      - id: codec-security
        content: Update docs/security/http1-codec.md — what changed in the parser's scan, why the differential is the proof, any finding with a before/after test or recorded open
        status: pending
      - id: codec-real
        content: The scan's gain must come from a general mechanism, not TFB's shape — no branch on the target, a known header set or request length; heads with long Cookie and Authorization values, many fields, a split read and pipelining go through the same fast path. Measure `node bench/http1-request/run.mjs --instructions --base <main>` and the timed run, and `bench/http1-parse/run.mjs`: the browser and api cases must improve beyond their band and no case may get worse beyond it
        status: pending
      - id: codec-measure
        content: Put before/after Ir per request (total and parse/write frames), the http1-request and http1-parse tables, the browser-head wrk run, and run.sh medians with the band for /plaintext and /json in the PR body and a Measured trailer; regenerate tests/self/goldens/checked and docs/reference, and add DECLARED entries to tests/nish-cmp.js if any corpus program's IR moves
        status: pending
  - id: head
    title: "perf(net): build a repeated HTTP/1 response head once per Date tick"
    goal: profile.sh shows the explicit entry's response-head frames on /plaintext cut by at least two thirds of the baseline's ~1,500 Ir per request, because Http1Server reuses a response head that differs from the last one only in Date, rebuilt when HttpDate ticks (once a second), with every byte on the wire unchanged and every header TFB requires present.
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js net_http1_server && node tests/run.js net_http_date && node tests/run.js tfb_entry && node tests/run.js tfb_async_entry && node tests/run.js net_serve && node bench/http1-request/run.mjs --validate && node bench/http1-request/run.mjs --instructions --base <main> && node scripts/security-scope.mjs && node scripts/gen-reference.mjs --check && bash scripts/fetch-seed.sh --force && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && bash bench/techempower/profile.sh --only plaintext (before on main, after on the branch) && bash bench/techempower/run.sh (plaintext and json rows)
    status: pending
    todos:
      - id: head-design
        content: In std/net/http1-server.ts, keep the last written head (status, fields, content length, the Date tick it was built in) per connection or per server and copy its bytes when the next response matches it, rebuilding through http1WriteResponseHead when anything differs or the Date tick moves; prefer this transparent form (no new public API) over an entry-specific path — if a public API is unavoidable, it gets its doc comment, guide page and reference
        status: pending
      - id: head-rules
        content: Write the TFB rule check in the PR — the plaintext and json requirements for Server, Date (and its once-a-second update), Content-Type and Content-Length, and that the body is still produced per request — citing the TFB requirement text, and confirm with a test that a response whose fields, status or length change, and one across a Date tick, are written fresh
        status: pending
      - id: head-tests
        content: Pin byte-for-byte answers for pipelined, keep-alive and close responses, the request-limit and error answers, and a head reused across many responses, in tests/link/net_http1_server* or a new net_http1_server_head_reuse; keep tfb_entry and tfb_async_entry green
        status: pending
      - id: head-security
        content: Record in docs/security/http1-codec.md (it scopes http1-server.ts) that a reused head cannot carry one response's fields into another's, with the test that shows it — that file is codec's, so this entry is added after rebasing on codec's merge; until then, carry the text in the PR body
        status: pending
      - id: head-real
        content: Reuse must be generic — any status, fields and body length a handler repeats, not TFB's plaintext response — and a miss must cost next to nothing. Measure `node bench/http1-request/run.mjs --instructions --base <main>` and the timed run: the json* and short cases (repeated heads) must improve beyond their band, and `varied` (every request a miss) and browser/api may not get worse beyond it; also the browser-head wrk run on /plaintext and /json
        status: pending
      - id: head-measure
        content: Put before/after Ir per request (total and head-write frames), the http1-request table, the browser-head wrk run, and run.sh medians with the band for /plaintext and /json in the PR body and a Measured trailer; regenerate tests/self/goldens/checked and docs/reference, and add DECLARED entries to tests/nish-cmp.js if any corpus program's IR moves
        status: pending
  - id: regate
    title: "docs(runtime): re-measure the explicit TFB entry against uWS and go-fasthttp after the codec work"
    goal: On main with codec and head merged, profile.sh and run.sh re-measure /plaintext and /json against the baseline and the twins, docs/BENCHMARKS.md and WP49 §6 item 3 carry the figures, and the acceptance criteria are answered with numbers, met or not.
    verification: npm run lint && node docs/check-links.mjs && bash bench/techempower/profile.sh --only plaintext && bash bench/techempower/run.sh (plaintext and json rows, entry, async, uws, go-fasthttp) && node bench/http1-request/run.mjs --instructions --base <baseline SHA> && node bench/http1-parse/run.mjs
    status: pending
    todos:
      - id: regate-profile
        content: Run profile.sh on /plaintext and /json on main with codec and head merged; report Ir per request against 5,419 and the baseline stage's figure, and the remaining frames
        status: pending
      - id: regate-run
        content: Run run.sh in the foreground, interleaved, on /plaintext at 256 and 1,024 connections and /json, explicit entry, async entry, uws and go-fasthttp, with the entry vs entry-copy band and RSS
        status: pending
      - id: regate-real
        content: Re-run the real-world set on main with codec and head merged — bench/http1-request (time and --instructions, --base at the baseline stage's SHA), bench/http1-parse, and the browser-head non-pipelined wrk runs — and put it beside the baseline's table, saying which real-world cases gained, by how much, and any that did not
        status: pending
      - id: regate-publish
        content: Add the re-measured section to docs/BENCHMARKS.md (with the baseline beside it), rewrite docs/wp49-async-server.md §6 item 3 (the plaintext gap to uWS) with the new standing, and put a Measured trailer in the commit; state plainly any acceptance figure that is not met rather than widening a band
        status: pending
---

# HTTP/1 plaintext codec

The explicit TechEmpower entry (`bench/techempower/main.ts` + `server.ts` on
`Http1Server`) answers /plaintext at 324k req/s at 256 connections on the
2026-10-21 machine, against uWS at 412k (about 21% ahead) and go-fasthttp at
380k (`docs/BENCHMARKS.md`). #1410's profile (plaintext, c=256, 16 pipelined):
**5,419 Ir per request**, 0.13 syscalls per request — the time is user space.

| where | Ir per request | share |
| --- | --- | --- |
| parse: `http1Next` 2,181, `http1TakeLine` 670 | ~2,850 | 53% |
| head write: `http1WriteResponseHead` 900, `http1HeadAppend` 253, `http1PutBytes` 145, `PutStatusLine`, `PutCrlf`, `PutDecimal` | ~1,500 | 28% |
| the loop | ~650 | 12% |

About 15 Ir per byte of a ~170-byte TFB request: the parser still walks most
bytes one at a time, although `http1TakeLine` already has a `u8x16` path.

## Before this run starts

- **#1407's fix-serve has merged.** It owns `std/net/http1-{server,codec}.ts`
  in that run. The lead spawns `baseline` only once fix-serve's PR has merged
  (and #1407's trim, which is async-path only, does not touch `http1-*`).
- **`bench/techempower/profile.sh`** comes from #1410. If #1410 has not merged
  when `baseline` starts, the worker copies it from
  `origin/feature/wp49-s6-gap/profile` into `$TMPDIR` and runs it from there;
  it does not add it to this run's branches.
- **main is green.** On 2026-11-11 main was red on `test (shard 4/8)`
  (`file-server: the 64 MiB file arrives whole to a stalling reader`). This run
  merges nothing while main is red.

## Stages

### baseline

**Owns:** `docs/BENCHMARKS.md` (a new section), `bench/techempower/README.md`, `bench/http-twins/README.md`, `bench/techempower/run.sh` and `bench/techempower/profile.sh` (harness bugs only), `bench/http1-request/**` (the `varied` case)

Measurement only, no source change. Benchmarks run in the foreground (an idle
container is reclaimed with its background run). `docs/BENCHMARKS.md` is also
edited by #1407's regate; a textual conflict there is resolved by keeping both
sections.

### codec

**Owns:** `std/net/http1-codec.ts`, `tests/link/net_http1_parse_diff/**`, `tests/link/net_http1/**`, `tests/link/net_http1_*window*/**` (the parser's), `tests/link/std_http1_*/**`, `tests/fuzz/{targets/http1.ts,corpus/http1/**,regressions/http1/**}`, `docs/security/http1-codec.md`, `docs/security/README.md` (its http1 row), `tests/nish-cmp.js`

Depends on: baseline (start — the ranked frames; merge). Concurrent with
`head`; the two share no source file. Byte loops in the *writer* live in
`http1-codec.ts`, so they are this stage's (candidate c), not `head`'s.

### head

**Owns:** `std/net/http1-server.ts`, `tests/link/net_http1_server*/**`, a new `tests/link/net_http1_server_head_reuse/**`, `docs/guide/` pages only if a public API is added. `docs/security/http1-codec.md` (which scopes `http1-server.ts` too) and its README row are codec's: head adds its record entry after rebasing on codec's merge

Depends on: baseline (start; merge), codec (merge only — `tests/nish-cmp.js`
and `docs/security/http1-codec.md` are codec's; head adds its DECLARED lines
and its record entry after codec merges, rebasing on it).
Candidate (b). TFB's rule check goes in the PR body.

### regate

**Owns:** `docs/BENCHMARKS.md`, `docs/wp49-async-server.md` (§6 item 3 only), `bench/techempower/README.md`

Depends on: codec and head (start and merge), and #1407's regate (merge —
both edit BENCHMARKS.md and WP49 §6).

## Real traffic, not just the benchmark

The owner's rule: the gains must hold for real-world use. TFB's request is
~170 bytes with a fixed header set, pipelined 16 deep; real clients send
500–800-byte heads (Cookie, Authorization, User-Agent, Accept-*), mostly one
request per read, and handlers answer with varying fields and lengths. So:

- **No benchmark-shaped fast path.** No branch on `/plaintext`, a known header
  set, a request length or the entry's response; a reviewer treats one as
  blocking.
- **The real-world gauges are measured in every stage**, before and after:
  `bench/http1-request` (browser, api, short, pipelined, split, json1k–40k and
  the new `varied` miss case; ns and Ir), `bench/http1-parse`, and a
  non-pipelined wrk run with a ~750-byte browser head. A fix that wins TFB
  but loses a real-world case outside its band is not done.

## Correctness and security

`std/net/http1-*` reads the network. The parser change keeps every
`net_http1_*` test and the fuzz targets' replays green, and the differential
(`tests/link/net_http1_parse_diff`, old parser frozen in `old.ts`) is the proof
that a speed change changed nothing else: accept or reject, the same status,
the same spans. Pipelining, keep-alive, the request limits and the error
answers stay byte for byte. `/json` and the async entry may not regress
outside their band.

## Out of scope

io_uring (measured not to pay, `bench/README.md` "Syscall cost"), multi-core
pinning and connection steering (WP49 §6 item 2), HTTP/2–3, the database
tests, a client on a separate machine, a public TFB submission.
