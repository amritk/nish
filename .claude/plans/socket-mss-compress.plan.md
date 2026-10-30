---
name: Socket MSS and pointless-compression skip in nish/net/http-compress
overview: Land HttpCompressor's segment mode, add a nish:net builtin that reads a connected socket's MSS, skip gzip when the uncompressed response already fits in one segment, settle when an Http1Connection's request head is readable, and wire the socket MSS into Http1Server.
stages:
  - id: segment-mode
    title: "feat(net): compression that pays for itself in nish/net/http-compress"
    goal: Put commit 668d14e1 (segment mode, now only on claude/affectionate-euler-oodmks) on main, synced and with regenerated goldens
    verification: npm run check && npm run lint && node tests/run.js std_http_compress && node tests/run.js std_compress && node tests/run.js net_http1_server
    todos:
      - id: carry-segment-mode
        content: Cherry-pick 668d14e1 onto the stage branch from main, resolve against the 7 newer main commits, regenerate goldens — see Stage segment-mode
        status: pending
      - id: verify-segment-mode
        content: Run the stage verification and read every skip line; open the PR with the original commit message as the PR body — see Stage segment-mode
        status: pending
  - id: socket-mss-builtin
    title: "feat(net): read a connected socket's MSS from nish:net"
    goal: A nish:net builtin returns TCP_INFO snd_mss, else TCP_MAXSEG, else -1, with every artifact a new builtin owes
    verification: npm run check && npm run lint && node tests/run.js net_ && node tests/run.js budget && node tests/run.js wasi && node tests/run.js performance && node scripts/security-scope.mjs
    todos:
      - id: mss-rule
        content: Write the docs/LANGUAGE.md rule for the builtin (name, signature, -1 contract, TypeScript reading) before code — see Stage socket-mss-builtin
        status: pending
      - id: mss-checker-emit
        content: Add the builtin to src/nish-modules.ts tables, checkNet in src/builtins.ts, lowering in src/emit-builtins.ts, the declare in src/runtime.ts, capabilities — see Stage socket-mss-builtin
        status: pending
      - id: mss-runtime
        content: Implement nish_net_mss in runtime/runtime-net.c and runtime/nish.h (TCP_INFO, TCP_MAXSEG fallback, -1) within the unit budget, plus the wasm32 and Node/browser behaviour — see Stage socket-mss-builtin
        status: pending
      - id: mss-tests
        content: Add tests/cases golden .ll + llvm-as + native round trip on a connected loopback socket, a reject_ negative case, nish-cmp DECLARED entry, differential goldens — see Stage socket-mss-builtin
        status: pending
      - id: mss-security
        content: Record the builtin in docs/security/runtime.md (scope, finding rows, property row) and update its index row in docs/security/README.md — see Stage socket-mss-builtin
        status: pending
      - id: mss-docs
        content: Add the cookbook entry and the docs/guide/using-nish/networking.md and docs/AI.md mentions — see Stage socket-mss-builtin
        status: pending
  - id: compress-skip-and-head
    title: "perf(net): skip gzip when the response already fits one segment"
    goal: Segment mode sends a one-segment response as it is without compressing it, measured, and the H1_END head question is settled with a test
    verification: npm run check && npm run lint && node tests/run.js std_http_compress && node tests/run.js net_http1_server && node scripts/security-scope.mjs
    todos:
      - id: skip-one-segment
        content: In HttpCompressor segment mode, decide NO_FEWER_SEGMENTS before compressing when the uncompressed head plus body fit in one MSS segment, no Vary, no gzip call — see Stage compress-skip-and-head
        status: pending
      - id: skip-tests
        content: Add tests/link/std_http_compress cases proving the body is sent as it is, decision is NO_FEWER_SEGMENTS, no Vary, and the encoder never ran — see Stage compress-skip-and-head
        status: pending
      - id: skip-bench
        content: Measure server CPU with bench/http-compress/run.mjs before and after, update bench/http-compress/README.md — see Stage compress-skip-and-head
        status: pending
      - id: h1-end-head
        content: Decide whether the request head stays readable until the response is written or is documented as H1_REQUEST-only, and pin it with a test — see Stage compress-skip-and-head
        status: pending
      - id: skip-docs
        content: Update docs/guide/using-nish/compression.md and docs/security/compress.md (and http1.md if the parser changes) — see Stage compress-skip-and-head
        status: pending
  - id: server-socket-mss
    title: "feat(net): Http1Server reads each connection's MSS from the socket"
    goal: Http1Server stores the socket MSS in conn.mss once per accepted connection, a configured value wins, and -1 falls back to HTTP_DEFAULT_MSS
    verification: npm run check && npm run lint && node tests/run.js net_http1_server && node tests/run.js std_http_compress
    todos:
      - id: wire-accept
        content: Call the MSS builtin once per accepted fd in Http1Server.accept and every other connection-start path in std/net/http1-server.ts, storing a positive result in conn.mss — see Stage server-socket-mss
        status: pending
      - id: wire-tests
        content: Add a test that a served connection's conn.mss is the socket's MSS on Linux and that enc.mss and an app-set conn.mss win — see Stage server-socket-mss
        status: pending
      - id: wire-docs
        content: Update docs/guide/using-nish/compression.md where it says the MSS is configured or defaults to 1448 — see Stage server-socket-mss
        status: pending
---

# Socket MSS and pointless-compression skip

## Context

HttpCompressor's segment mode sends gzip only when the whole response, head included, needs fewer TCP segments than the uncompressed one ([std/net/http-compress.ts](../../std/net/http-compress.ts), `Http1Connection.respondEncoded` in [std/net/http1-server.ts](../../std/net/http1-server.ts)). It is in commit `668d14e1` on `claude/affectionate-euler-oodmks`, which is not on `main` and has no PR. The MSS comes from `enc.mss`, `conn.mss` or `HTTP_DEFAULT_MSS` (1448), because `nish:net` cannot read it from the socket. Segment mode also compresses before it decides, wasting CPU on responses that already fit in one segment. Separately, the HTTP/1 parser resets the head at `HTTP1_S_MESSAGE_END` (`http1StartRequest` in [std/net/http1.ts](../../std/net/http1.ts)), so `conn.acceptEncoding()` and `targetIs()` at `H1_END` read an empty head.

## Approach

Four stages, one PR each. `segment-mode` lands the existing commit so the others have something to build on. `socket-mss-builtin` is compiler + runtime only and runs in parallel with it. `compress-skip-and-head` starts when `segment-mode` merges. `server-socket-mss` is the small wiring PR that needs both the builtin and the skip on `main`; it is split off so the builtin stage never touches `std/net/http1-server.ts` while `compress-skip-and-head` owns it.

| stage | starts | merges after |
| --- | --- | --- |
| segment-mode | now | — |
| socket-mss-builtin | now | segment-mode |
| compress-skip-and-head | segment-mode merged | segment-mode |
| server-socket-mss | socket-mss-builtin and compress-skip-and-head merged | both |

Constraints for every stage: compression stays off unless the app asks for it; nothing is cached between responses; `docs/guide/using-nish/compression.md` moves with any change a user sees; commits follow `CLAUDE.md` (conventional subject, no session links, model names or platform attributions).

**Shared files, split by section.** Two files are edited by concurrent stages in different places. Each stage touches only its own part, and git merges them line-wise:

| file | segment-mode | socket-mss-builtin | compress-skip-and-head |
| --- | --- | --- | --- |
| [docs/security/README.md](../../docs/security/README.md) | compress row (as in 668d14e1) | runtime row | compress and HTTP/1.1 rows, only after segment-mode merged |
| [docs/AI.md](../../docs/AI.md) | compression lines (as in 668d14e1) | nish:net builtin list | — |

`socket-mss-builtin` edits these two files only after it has merged `main` with `segment-mode` in.

**Generated files** are shared by every stage and regenerated, never edited or hand-merged: `tests/self/goldens/**`, `tests/differential/goldens/**`, `tests/differential/emit-ts-known.txt` (only under the CI-pinned Node), the runtime-prelude block of `docs/IR_COOKBOOK.md` (`docs/cookbook/regen.sh`).

## Stage segment-mode

**Owns:** `bench/README.md`, `bench/gzip/**`, `bench/http-compress/**`, `docs/AI.md` (compression lines), `docs/guide/using-nish/compression.md`, `docs/security/README.md` (compress row), `docs/security/compress.md`, `std/README.md`, `std/compress/deflate.ts`, `std/compress/gzip.ts`, `std/net/http-compress.ts`, `std/net/http1-server.ts`, `tests/link/std_compress_node/**`, `tests/link/std_http_compress/**`, plus regenerated `tests/self/goldens/**`.

- `git cherry-pick 668d14e1` (fetch `origin claude/affectionate-euler-oodmks` first) onto the stage branch cut from `main`. Resolve conflicts against main's newer commits in the source files only; for `tests/self/goldens/checked/**` take either side and regenerate with `node tests/self/goldens.js --update`.
- Do not change behaviour. Anything wrong in the commit becomes a note in the PR body unless it fails a test or the verification.
- PR title is the commit subject; the PR body is the commit's body, trailers included.

## Stage socket-mss-builtin

**Owns:** `src/**`, `runtime/**`, `tests/cases/*mss*`, `tests/cases/reject_*mss*`, `tests/wordings/**` (new file only), `tests/run.js`, `tests/nish-cmp.js`, `tests/runtime-budgets.js`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/guide/using-nish/networking.md`, `docs/security/runtime.md`, `docs/security/README.md` (runtime row), `docs/AI.md` (nish:net list), plus regenerated generated files.

Model the builtin on `netSetOption` (`src/nish-modules.ts` tables, `checkNet` in `src/builtins.ts`, `src/emit-builtins.ts`, `src/runtime.ts` declare, `src/capabilities.ts`, `runtime/runtime-net.c` + `runtime/nish.h`, `runtime/nish.mjs` / `nish.d.ts` / `shim.mjs`). Working name `tcpMss(fd: i32): i32`; rename to match the module's naming if it reads better, and put the final name in the PR body, because `server-socket-mss` calls it.

```c
// runtime/runtime-net.c — shape, not code
int32_t nish_net_mss(int32_t fd);
// Linux: getsockopt(TCP_INFO) -> tcpi_snd_mss if > 0
// else getsockopt(TCP_MAXSEG) where TCP_MAXSEG is defined, if > 0
// else -1 (also for a bad fd, an unconnected socket, non-Linux without TCP_MAXSEG, wasm32)
```

- Contract: returns a positive MSS or -1; never panics, never reports errno. Per the requirement it returns -1 on WASI rather than refusing to compile; say in the LANGUAGE.md rule why this differs from `netSetOption`'s `refuseOnWasm`. Node and browser targets follow whatever the existing nish:net readers do there (`shim.noNetReading`), stated in the rule.
- Follow `docs/ARCHITECTURE.md` → "How to add a construct" and `.claude/selfhost.md` → "Adding a builtin" in full: LANGUAGE.md rule first; a `src/codes.ts` diagnostic + `tests/wordings/` program if the builtin adds one; runtime within its budget (`node tests/run.js budget`); golden `.ll`, `llvm-as` pass, native round trip on a connected loopback socket (expected stdout checks the value is positive, not a fixed number), a `reject_*` negative case, the `tests/nish-cmp.js` DECLARED entry, `node tests/differential/goldens.js --update` for the new positive case.
- The rolling freeze: `src/` itself must not call the builtin.
- Security record: `docs/security/runtime.md` gets the function in scope, a finding row per issue found (fixed with a before/after test, or recorded open — e.g. what a hostile peer can make the kernel report), and a "Properties verified" row; the README runtime row counts follow. `node scripts/security-scope.mjs` must pass.
- Show the exact LLVM IR for each TypeScript snippet the PR adds to the tests in the PR body (`CLAUDE.md`).

## Stage compress-skip-and-head

**Owns:** `std/net/http-compress.ts`, `std/net/http1.ts`, `std/net/http1-server.ts`, `bench/http-compress/**`, `docs/guide/using-nish/compression.md`, `docs/security/compress.md`, `docs/security/http1.md`, `docs/security/README.md` (compress and HTTP/1.1 rows), `tests/link/std_http_compress/**`, `tests/link/net_http1_server*/**`, new `tests/link/std_http1_*/**`, plus regenerated generated files.

**Skip.** In segment mode, before any encoder runs: if the uncompressed response (head as it would be sent without `Content-Encoding`, plus body) is at most one segment of the effective MSS, the decision is `HTTP_COMPRESS_NO_FEWER_SEGMENTS`, the body goes as it is, no `Vary: Accept-Encoding`, and no gzip work happens at all. Larger responses keep today's compress-then-compare path. Only `segmentMode` changes; `minLength` and `minSaving*` behave as before.

- Tests in `tests/link/std_http_compress/main.ts`: a one-segment response yields NO_FEWER_SEGMENTS with no Content-Encoding and no Vary; the encoder was not called (expose a count or use an observable the module already has; no cache between responses); a response just over one segment still compresses when it saves a segment; a client that does not accept gzip still gets NOT_ACCEPTED with Vary.
- Bench: run `bench/http-compress/run.mjs` against the base and the change (and a byte-identical base copy for the noise band, per `.claude/testing.md` → "A `Measured:` trailer"); put the figures in `bench/http-compress/README.md` and a `Measured:` trailer.

**H1_END head.** Investigate `http1StartRequest` being called at `HTTP1_S_MESSAGE_END` for keep-alive. Choose one and justify it in the PR body:

1. Keep the head (method, target, header spans) readable until the response is written, resetting when the next request starts — then `acceptEncoding()`, `targetIs()` and a router at `H1_END` see the request. Must not cost per-request copies, must not let a pipelined next request's bytes be read as this one's head, and the parser's security record (`docs/security/http1.md`) records the change.
2. Document on `acceptEncoding()`, `targetIs()` and the guide that they must be called at `H1_REQUEST` (or `H1_BODY`), and make the misuse fail loudly or return a defined value.

Either way, add a test: a request with `Accept-Encoding: gzip` over keep-alive with a second pipelined request, asserting what `acceptEncoding()` returns at `H1_END` for the first.

## Stage server-socket-mss

**Owns:** `std/net/http1-server.ts`, `docs/guide/using-nish/compression.md`, `tests/link/std_http_compress/**`, new `tests/link/std_http1_mss/**`, plus regenerated generated files.

- In `Http1Server.accept` after `this.fds[k] = fd`, and at every other place a connection starts (there is a second `conn.restart()` call; check each), call the builtin once and set `conn.mss` when the result is positive. Leave `conn.mss` at 0 (meaning "use the default") on -1.
- Precedence stays `enc.mss` > `conn.mss` > `HTTP_DEFAULT_MSS`; an app that sets `conn.mss` after accept overrides the socket value. Keep-alive reuse does not re-read it.
- Test on Linux over loopback: a served connection's `conn.mss` is positive and equals a direct read of the same fd; `enc.mss` wins; an app-set `conn.mss` wins.
- Guide: `compression.md` says the MSS is read from the socket where the platform reports it, else 1448.

## Out of scope

- Reading MSS for TLS, HTTP/2 or HTTP/3 connections.
- Changing `minLength` / `minSaving` policy, the encoders, or making compression on by default.
- Caching compressed bodies or decisions across responses.

## Verification

Per stage, the stage's `verification` line. A stage touching `src/` also runs `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`, read the skip line) and `node tests/run.js performance`. The full suite is CI's four `test (…, shard N/4)` jobs, each green on the PR head with its skip count read.
