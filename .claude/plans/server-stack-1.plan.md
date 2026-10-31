---
name: Server stack 1 — handler layer, fast rebuilds, hot reload, and the server std modules
overview: Nine independent pieces of Nish's API-server story, one PR each — a request/response handler layer over the HTTP/1 carrier, fast `nish run` rebuilds and `--watch` hot reload, server-grade Postgres, typed-JSON presence and merge patch, JWT, a batching bcrypt pool, outbound safety for the HTTP client, and capability grants with arguments.
stages:
  - id: s1-handler
    title: "feat(interop): nish/net/handler, a request and response layer over the HTTP/1 carrier"
    goal: A server author routes and answers complete requests through nish/net/handler instead of driving Http1Server events, at the carrier's speed.
    verification: npm run check && npm run lint && node tests/run.js net_handler && node tests/run.js net_http_app && node tests/run.js net_http1 && node scripts/security-scope.mjs
    todos:
      - id: s1-module
        content: Add std/net/handler.ts — pooled requests, routing at H1_REQUEST, body cap 413, response writer, JsonWriter and problem+json helpers — see Stage 1
      - id: s1-carriers
        content: Follow the same interface over the HTTP/2 and HTTP/3 carriers where it costs little, or record why not in the WP43 note — see Stage 1
      - id: s1-example
        content: Add examples/http-app, a small JSON API with logging, configuration and graceful shutdown routing through nish/net/router — see Stage 1
      - id: s1-tests
        content: Add tests/link loopback tests for routing, limits, pipelining, the late-answer drop and the flat arena — see Stage 1
      - id: s1-bench
        content: Route bench/http1-server.ts through the handler and measure against the base with its noise band — see Stage 1
      - id: s1-docs
        content: Update docs/wp43-http-app-layer.md stage 2, add the API-server guide page and its scalar.config.json route, the security record and its index row — see Stage 1
  - id: s3-fast-rebuilds
    title: "perf(cli): fast rebuilds for nish run"
    goal: Rebuilding a ~560-line server program with nish run after a one-line change takes under 2 s on a 4-core container, or the gap and its cause are recorded.
    verification: npm run check && npm run lint && node tests/run.js "nish run" && node tests/run.js self && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: s3-measure
        content: Measure where a nish run rebuild spends its time (front end, check, emit, opt, llc or clang, link) on examples/http-app or an equivalent and record it — see Stage 3
      - id: s3-changes
        content: Implement the changes the numbers justify in src/run-cache.ts and src/compile.ts, keeping the release recipe byte-identical and the fixed point — see Stage 3
      - id: s3-tests
        content: Extend the run cache tests in tests/run.js to cover every new cache — see Stage 3
      - id: s3-docs
        content: Write the measurements up (a docs/wp note) and state in docs/guide/using-nish/cli.md what nish run caches — see Stage 3
  - id: s4-watch
    title: "feat(cli): nish run --watch rebuilds and swaps the running program"
    goal: nish run --watch rebuilds on a source change and swaps the process with no refused connection, keeping the old one on a failed build.
    verification: npm run check && npm run lint && node tests/run.js watch && node tests/run.js "nish run" && npm run test:cli && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: s4-watcher
        content: Add the watcher to the nish run driver — module-graph file set, debounce, cancel-older rebuild, NISH watch environment variable, rebuild timing — see Stage 4
      - id: s4-swap
        content: Start-new-then-stop-old swap with SO_REUSEPORT and SIGTERM, the failed-build path keeping the old process, clean Ctrl-C — see Stage 4
      - id: s4-cli-surface
        content: Add the --help entry, the docs/guide/using-nish/cli.md section, and an AGENTS.md row if an exit code is added — see Stage 4
      - id: s4-tests
        content: Add end-to-end tests in tests/run.js that edit a file and see the new behaviour, the failed-build case, and a server that loses no request across a swap — see Stage 4
  - id: s5-postgres
    title: "feat(interop): nish/net/postgres for servers — read/write pools, session options, group commit, reconnect"
    goal: std/net/postgres.ts gives a high-throughput server per-worker read/write pools, prepared statements, durable group commit and backed-off reconnects.
    verification: npm run check && npm run lint && node tests/run.js net_postgres && node scripts/security-scope.mjs && PG_TEST_URL=postgres://nish_live:nish-live@127.0.0.1:5432/nish_live node tests/postgres/live/run.mjs
    todos:
      - id: s5-pools
        content: Per-worker pools split into read and write connections, statements prepared on every connection at startup, pipelining several groups per connection — see Stage 5
      - id: s5-session-options
        content: Startup session options in PgConfig with documented server defaults — see Stage 5
      - id: s5-group-commit
        content: Durable group commit with per-write retry on a failed group and no retry on a lost connection — see Stage 5
      - id: s5-reconnect
        content: Lost-connection handling with a clear error, slot rebuilt on demand, reconnect with backoff and jitter — see Stage 5
      - id: s5-binary
        content: Binary result rows where text is read today, only if a measurement shows it helps — see Stage 5
      - id: s5-docs-bench
        content: Tests against the live Postgres setup, the guide's for-servers section, the security record's new failure modes, a group-commit benchmark — see Stage 5
  - id: s7-json-presence
    title: "feat(checker): typed JSON decode reports which fields were present"
    goal: A caller of jsonDecode can tell absent from present-with-default for every field with no allocation per decode, and implement RFC 7396 merge patch on it.
    verification: npm run check && npm run lint && node tests/run.js json_presence && node tests/run.js json_merge_patch && node tests/run.js json && node tests/run.js self && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: s7-design
        content: Choose the presence design (bit mask the compiler-written decoder fills, or equivalent zero-allocation design) and record why — see Stage 7
      - id: s7-lowering
        content: Implement it in src/json-typed.ts and src/emit-json.ts and expose it from std/json-typed.ts — see Stage 7
      - id: s7-merge-patch
        content: Add a documented merge-patch recipe or helper and a merge-patch example that compiles and runs natively — see Stage 7
      - id: s7-tests-docs
        content: Tests for present, absent and null per field kind, goldens, IR per snippet, LANGUAGE.md Typed JSON rule, cookbook entry, JSON guide section, a Measured trailer for decode speed — see Stage 7
  - id: s8-jwt
    title: "feat(interop): nish/crypto/jwt, compact JWS verify and sign with claims checks"
    goal: std/crypto/jwt.ts verifies and signs compact JWS over RS256, ES256, ES384, EdDSA and HS256/384/512 with claims checks, refusing none and algorithm confusion.
    verification: npm run check && npm run lint && node tests/run.js crypto_jwt && node tests/run.js fuzz && node scripts/security-scope.mjs
    todos:
      - id: s8-module
        content: Add std/crypto/jwt.ts — key-decides-algorithm, constant-time compare, size cap, HMAC pads keyed once, no allocation per verify after warm-up — see Stage 8
      - id: s8-claims
        content: Claims checks for exp, nbf, iat with leeway, iss, aud, sub — see Stage 8
      - id: s8-tests
        content: RFC 7515/7518/8037 vectors, known-bad tokens, and a fuzz target in the fuzz section of tests/run.js — see Stage 8
      - id: s8-docs
        content: The docs/security record and index row, and an auth guide page with its scalar.config.json route — see Stage 8
  - id: s10-bcrypt-pool
    title: "feat(interop): a batching bcrypt pool off the event loop"
    goal: A server hashes and verifies bcrypt passwords from its event loop without blocking, through a batching, bounded, self-healing pool answered via a pollable descriptor.
    verification: npm run check && npm run lint && node tests/run.js crypto_bcrypt && node tests/run.js wipe && node scripts/security-scope.mjs
    todos:
      - id: s10-measure
        content: Measure processes against threads for the pool's workers and record the choice and why — see Stage 10
      - id: s10-module
        content: Add the pool module next to std/crypto/bcrypt.ts — lane batching, bounded queue with a clear refusal, worker-loss recovery, Secret inputs wiped — see Stage 10
      - id: s10-tests-bench
        content: Tests for batching, the full queue, worker loss and wiping, and a benchmark against serial bcrypt — see Stage 10
      - id: s10-docs
        content: The security record and a password-hashing guide section on using it in a server — see Stage 10
  - id: s11-outbound
    title: "feat(interop): an outbound policy for the HTTP client"
    goal: A server fetching URLs it did not choose can opt into a policy that only reaches public addresses, re-checks every redirect hop, and caps time and size.
    verification: npm run check && npm run lint && node tests/run.js net_outbound && node tests/run.js net_http1_client && node scripts/security-scope.mjs
    todos:
      - id: s11-policy
        content: Add the opt-in outbound policy to std/net/http-client.ts — resolved-address checks, connect to the checked address, optional host allowlist — see Stage 11
      - id: s11-redirects-limits
        content: Redirect limits re-checking every hop, timeouts, response size caps — see Stage 11
      - id: s11-tests-docs
        content: Before/after tests (SSRF, rebinding, redirects, IPv6 and IPv4-mapped forms), the security record and index row, and the HTTP client guide section — see Stage 11
  - id: s12-capability-args
    title: "feat(checker): capability grants with arguments, and fs gated for dependencies"
    goal: Dependencies need a grant for fs.read and fs.write, grants carry arguments the compiler checks statically and the sandbox enforces at run time, and existing grants keep working.
    verification: npm run check && npm run lint && node tests/run.js caps_ && node tests/run.js sandbox && node tests/run.js capabilities && node scripts/security-scope.mjs && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance
    todos:
      - id: s12-fs-gate
        content: Gate fs.read and fs.write for dependencies like unsafe, ffi, net and process.spawn — see Stage 12
      - id: s12-grant-args
        content: Grants with arguments (fs directory root, process.spawn binary, net host list), checked statically where visible — see Stage 12
      - id: s12-sandbox
        content: Enforce the rest through the WP37 sandbox at run time (Landlock paths, exec allowlist, network rules where the platform allows) — see Stage 12
      - id: s12-lockfile
        content: Record grant arguments in the capability lockfile — see Stage 12
      - id: s12-docs-tests
        content: LANGUAGE.md rule, capabilities security record, WP40 note, codes in src/codes.ts, caps_ and sandbox tests, sandbox guide page, migration notes in the PR body — see Stage 12
---

# Server stack 1

## Context

Nish already has the pieces of a fast HTTP server (the HTTP/1, HTTP/2 and HTTP/3 carriers, `std/net/router.ts`, `std/net/postgres.ts`, `std/json-typed.ts`, `std/crypto/*`, the WP37 sandbox and WP40 dependency capabilities), and a hand-written Nish server holds 91,000 users on an 8-core box. What is missing is the layer and the tooling that make that the *easy* way to write an API server: a request/response handler layer, a fast edit-rebuild-run loop, and server-grade versions of the std modules a real API needs.

Reference implementation for several stages: <https://github.com/amritk/multicore-server-challenge>, `submissions/nish-std-amritk`. Workers read only the files their stage names, and check `.claude/licensing.md` before copying any of it into `std/`.

Each stage is one PR, written by one worker session, against `main`. The full text each worker gets is its stage section below plus the run's shared preamble.

## Approach

- **One stage per requirement.** The nine stages map one-to-one onto the nine requests; none is split, because each is one PR's worth and none consumes another's interface.
- **Ordering.** Stage 4 (hot reload) starts only after stage 3 (fast rebuilds) merges, because both rewrite the `nish run` driver. Stage 5 merges after amritk/nish#1111 (Postgres over a Unix socket), or resolves that conflict at its turn. Everything else starts immediately, four at a time.
- **The rolling freeze bites stage 4.** `src/` may not use a construct or builtin the seed does not have, so the watcher in the compiler's own driver is written with the builtins the seed already ships (for example polling file times rather than a new inotify builtin), unless it lands the builtin now and uses it a release later.
- **The lead merges.** Stages 1, 3, 4, 5 and 7 are squash-merged by the run's lead when the merge gate passes. Stages 8, 10, 11 and 12 (crypto, secrets, security boundaries) are taken fully green and converged, then handed to the maintainer to merge.

### Shared files

Where several stages must touch one file, it is listed here. Each is **append-only** for the stages that share it (a new section, row, entry or route; no rewrite of existing text), and the stage that merges second resolves the textual conflict when it takes in `main` (`npm run sync-main`).

| File | Appended by | Notes |
| --- | --- | --- |
| `tests/run.js` | every stage | each stage adds its own section/filter |
| `docs/security/README.md` (index) | s1, s5, s8, s10, s11, s12 | one row per new or changed record |
| `std/README.md` (table) | s1, s5, s8, s10, s11 | one row per new module |
| `llms.txt` | s1, s4, s8, s10, s11, s12 | |
| `scalar.config.json` | s1, s8 | one route each |
| `src/codes.ts` | s12 owns; s4, s7 may append | a new code takes the next free number in its band; the second to merge renumbers its own new codes, never an existing one |
| `docs/LANGUAGE.md` | s7 ("Typed JSON"), s12 ("A dependency's capabilities") | each edits only its own section |
| `docs/guide/using-nish/cli.md` | s3, then s4 (serial) | |
| `THIRD_PARTY_NOTICES.md` | any stage that copies code | |
| `src/std-modules.ts` (the std module list), `.github/workflows/release.yml` (the std-module presence gates only) | every stage that adds a new `std/` module (s1, s5, s7, s8, s10, s11) | one entry per new module, nothing else; required by the self-hosting section, found by s1 |
| `tests/wipes/crypto.js` | s8, s10 | one entry per wiped `Secret` |
| `tests/fuzz/targets/*`, `tests/fuzz/harness.c` | s8 (new target), s11 if it adds one | a new target file each |
| `src/runtime.ts`, `runtime/nish.h`, `runtime/nish.d.ts` | any stage that needs a new builtin | declarations only; a stage that adds a builtin also runs the wasi and performance runs |
| `src/compile.ts`, `src/options.ts`, `src/compilation.ts` | s3 then s4 (the `nish run` driver), s12 (grant and `--sandbox` handling) | s12 edits only the capability, grant and sandbox functions; s3/s4 only the run driver and build recipe |

**Generated files** (regenerated with the repo's tooling, never edited or hand-merged): `tests/self/goldens/checked/**`, `tests/differential/goldens/**`, `tests/differential/*-known.txt`, `tests/differential/known-failures.txt`, `tests/cases/**/*.ll` goldens written by `UPDATE_GOLDENS=1`.

## Stage 1 — nish/net/handler

**Owns:** `std/net/handler.ts`, `std/net/handler-*.ts`, `std/net/http1-server.ts`, `std/net/http1.ts`, `std/net/http2.ts`, `std/net/http3-server.ts`, `std/net/router.ts`, `examples/http-app/**`, `examples/prefork-server.ts`, `bench/http1-server.ts`, `bench/http-app*`, `tests/link/net_handler*/**`, `tests/link/net_http_app*/**`, `docs/wp43-http-app-layer.md`, `docs/guide/using-nish/api-server.md`, `docs/guide/using-nish/http-router.md`, `docs/security/handler.md`, `docs/security/router.md`, `docs/security/http1.md` · shared append-only: `tests/run.js`, `docs/security/README.md`, `std/README.md`, `llms.txt`, `scalar.config.json`

Build stage 2 of `docs/wp43-http-app-layer.md`: one request and response pair over the HTTP/1 carrier, HTTP/2 and HTTP/3 following the same interface where it costs little. Route at `H1_REQUEST` (the parser's head is only valid until the body starts), keep method, target and path parameters in the request's own storage. No function values: the router answers a route index, the program switches on module constants; the handler layer owns body accumulation, limits, keep-alive and pipelining. Design so callers never need a throwaway `Result` bind.

Request: method, target, path parameters (spans plus a decoding helper), percent-decoded query lookup, headers by name, the body as a span once complete, a configurable body cap answering 413. Response: status, headers, a body in one call or streamed, JSON through `JsonWriter`, RFC 9457 problem details (`application/problem+json`). Pooled requests on a free list, strings as spans, a slot generation dropping late answers. No allocation per request after warm-up, pinned by a flat-arena test. `examples/http-app` is a small JSON API with logging, configuration and graceful shutdown routing through `nish/net/router`. `bench/http1-server.ts` routes through it with no measurable loss (state the noise band).

## Stage 3 — Fast rebuilds for nish run

**Owns:** `src/run-cache.ts`, `src/compile.ts` (run driver and build recipe), `src/options.ts` (run flags), `src/compilation.ts` (per-module emission only), `src/build-cache*.ts`, `scripts/build.sh`, `docs/wp*-run-rebuilds.md` (new note), `docs/guide/using-nish/cli.md` · shared append-only: `tests/run.js`

Measured today on a 4-core container: a ~560-line HTTP + SQLite + JSON program takes ~33 s the first time (vendored SQLite compiled once, then cached) and 5–7 s after a one-line change. Target: under 2 s after a one-line change, and say what a 5,000-line program takes. Measure first (front end, check, IR emission, opt, llc or clang, link) and record it, then pick what the numbers justify: a debug recipe skipping work, per-module object caching keyed by module IR, cached std objects, parallel per-module codegen, a faster linker when present. The release recipe's output stays byte-identical; the bootstrap fixed point holds. Run cache tests cover the new caching; the guide's CLI page states what `nish run` caches. `Measured:` trailer with its noise band.

## Stage 4 — nish run --watch

**Depends on:** s3 merged before this stage starts.

**Owns:** `src/compile.ts` (run driver), `src/options.ts`, `src/cli-style.ts`, `src/watch*.ts`, `docs/guide/using-nish/cli.md`, `AGENTS.md` (exit-code table row only), `tests/nish/cli.ts` · shared append-only: `tests/run.js`, `src/codes.ts`, `llms.txt`

`nish run --watch program.ts [args]` builds and runs the program, watches every source file in its module graph (std excluded unless changed in a checkout), and on a change rebuilds and swaps. A failed build prints its diagnostics (`--json` objects under `--json`) and keeps the old process. A good build starts the new process before stopping the old: a server binds the same port with `SO_REUSEPORT`, the old process gets SIGTERM and drains if a draining shutdown is on `main` by then (otherwise the PR says the drain arrives later). A non-server is stopped then restarted. Debounced; a newer rebuild cancels an older one. An environment variable tells the program it runs under `--watch`; each rebuild's time is printed. Ctrl-C stops watcher and program cleanly. CLI surface: `--help` entry, guide section, AGENTS.md row if an exit code is added, end-to-end tests that edit a file and see the new behaviour, the failed-build case, and a server losing no request across a swap. Mind the rolling freeze (see Approach).

## Stage 5 — Postgres for servers

**Merge after:** amritk/nish#1111, or resolve its conflict at this stage's turn.

**Owns:** `std/net/postgres.ts`, `std/net/postgres-*.ts`, `tests/postgres/**`, `tests/link/net_postgres*/**`, `bench/postgres*`, `docs/guide/using-nish/postgres.md`, `docs/security/postgres.md` · shared append-only: `tests/run.js`, `docs/security/README.md`, `std/README.md`

Per-worker pools split into read and write connections, statements prepared on every connection at startup, several groups pipelined per connection. Startup session options in `PgConfig` with documented server defaults (`plan_cache_mode=force_generic_plan`, `jit=off`, `max_parallel_workers_per_gather=0`). Durable group commit: writes queue while a group is in flight, then up to N writes or M bytes of binds go as one group with one commit; each caller's answer waits for its ReadyForQuery; a failed group retries each write alone; a write on a lost connection is never retried. Lost connections fail in-flight requests clearly, rebuild the slot on demand, and reconnect with backoff and jitter. Binary result rows only if a measurement shows a gain. Tests against a real Postgres in the existing setup (`tests/postgres/live/run.mjs`, CI's `postgres-live` job), a "for servers" guide section, the security record's new failure modes, and a group-commit benchmark with a `Measured:` trailer. Reference: the challenge entry's `src/worker.ts`, `src/sql.ts`, README.

## Stage 7 — Typed JSON presence and merge patch

**Owns:** `src/json-typed.ts`, `src/emit-json.ts`, `std/json-typed.ts`, `std/json-patch*.ts`, `tests/cases/json_presence*`, `tests/cases/json_reject_presence*`, `tests/cases/json_merge_patch*`, `tests/link/json_presence*/**`, `tests/link/json_merge_patch*/**`, `examples/merge-patch*`, `bench/json-typed*`, `docs/IR_COOKBOOK.md`, `docs/guide/using-nish/standard-library.md` (JSON section), `docs/security/json.md` · shared append-only: `tests/run.js`, `docs/LANGUAGE.md` ("Typed JSON" only), `src/codes.ts`

`jsonDecode` sets a missing optional key to its initializer, so a caller cannot tell absent from present-with-default, and a PATCH handler cannot implement RFC 7396 (absent keeps, null clears a nullable field, null on a non-nullable field is an error). Add presence reporting (a bit mask the compiler-written decoder fills, or an equivalent design allocating nothing per decode) and a documented merge-patch recipe or helper. Follows `.claude/selfhost.md`: goldens, the LANGUAGE.md "Typed JSON" rule, a cookbook entry, the IR for each new test snippet, the wasi and performance runs. Tests cover present, absent and null for every field kind json-typed supports; a merge-patch example compiles and runs natively; decode speed without presence is unchanged (`Measured:` trailer).

## Stage 8 — nish/crypto/jwt

**Owns:** `std/crypto/jwt.ts`, `std/crypto/jwt-*.ts`, `std/crypto/hmac.ts` (a keyed-state copy API, if needed), `tests/link/crypto_jwt*/**`, `tests/cases/crypto_jwt*`, `tests/fuzz/targets/jwt*`, `tests/fuzz/corpus/jwt*/**`, `docs/security/crypto-jwt.md`, `docs/guide/using-nish/auth.md` · shared append-only: `tests/run.js`, `docs/security/README.md`, `std/README.md`, `llms.txt`, `scalar.config.json`

Compact JWS verify and sign over RS256 (`rsa.ts`), ES256 and ES384 (`p256.ts`, `p384.ts`), EdDSA (`ed25519.ts`), HS256/384/512 (`hmac.ts`), with claims checks (exp, nbf, iat with configurable leeway, iss, aud, sub). Refuse `alg: none` and algorithm confusion (the key decides the algorithm, not the header); constant-time signature comparison; a token size cap; for HMAC, key the pads once and copy the state per token; no allocation per verify after warm-up where the algorithm allows. Attacker-facing crypto: its security record (scope, threat model, findings with before/after tests) and index row, RFC 7515/7518/8037 vectors and known-bad tokens, a fuzz target in the fuzz section of `tests/run.js`, and an auth guide page. Reference: the challenge entry's `src/jwt.ts`.

## Stage 10 — A batching bcrypt pool

**Owns:** `std/crypto/bcrypt.ts`, `std/crypto/bcrypt-pool*.ts`, `tests/link/crypto_bcrypt_pool*/**`, `bench/bcrypt-pool*`, `bench/crypto/bcrypt*`, `docs/security/crypto-bcrypt.md`, `docs/guide/using-nish/password-hashing.md` · shared append-only: `tests/run.js`, `docs/security/README.md`, `std/README.md`, `llms.txt`, and the builtin declaration files if a builtin is needed

bcrypt at cost 10 stalls a single-threaded loop for tens of milliseconds. A std module next to `std/crypto/bcrypt.ts`: a pool the event loop calls without blocking, answered through a descriptor the loop polls, batching across lanes (four lanes ≈ 1.4 hashes of time), a bounded queue refusing with a clear error when full, and recovery when a worker is lost. Processes or threads chosen by measurement, with the reason written down. Passwords and intermediates are `Secret` and wiped. Security record, tests for batching, the full queue, worker loss and wiping, a benchmark against serial bcrypt (`Measured:`), and a "in a server" section on the password-hashing page. Reference: the challenge entry's `src/bcrypt-service.ts` and its use in `src/worker.ts`.

## Stage 11 — Outbound safety for the HTTP client

**Owns:** `std/net/http-client.ts`, `std/net/http1-client.ts`, `std/net/outbound*.ts`, `std/net/dns.ts`, `std/net/dns-resolver.ts`, `tests/link/net_outbound*/**`, `tests/link/net_http_client*/**`, `tests/link/net_http1_client*/**`, `docs/security/http-client.md`, `docs/security/http1-client.md`, `docs/security/outbound.md`, `docs/guide/using-nish/http-client.md` · shared append-only: `tests/run.js`, `docs/security/README.md`, `std/README.md`, `llms.txt`

An opt-in outbound policy for servers fetching URLs they did not choose: only public addresses after DNS resolution (no loopback, private, link-local, CGNAT or metadata ranges), checked on the resolved address with the connection made to that same address so rebinding cannot switch it; an optional host allowlist; redirect limits that re-check every hop; timeouts; response size caps. Its security record (SSRF, DNS rebinding, redirect tricks, IPv6 and IPv4-mapped forms) with before/after tests and index row, and a section in the HTTP client guide page.

## Stage 12 — Capability grants with arguments

**Owns:** `src/capabilities.ts`, `src/capability-lock.ts`, `src/capability-report.ts`, `src/manifest.ts`, `src/compile.ts` and `src/options.ts` and `src/compilation.ts` (grant and sandbox functions only), `src/emit.ts` (the entry wrapper's sandbox call only), `src/codes.ts`, `runtime/runtime-sandbox.c`, `tests/cases/caps_*`, `tests/link/caps_*/**`, `tests/link/sandbox_*/**`, `tests/capabilities.js`, `docs/wp40-dependency-capabilities.md`, `docs/wp37-os-sandbox.md`, `docs/security/capabilities.md`, `docs/security/sandbox.md`, `docs/guide/using-nish/sandbox.md` · shared append-only: `tests/run.js`, `docs/LANGUAGE.md` ("A dependency's capabilities" only), `docs/security/README.md`, `llms.txt`

WP40 refuses a dependency reaching unsafe, ffi, net or process.spawn without a root `package.json` grant, but files are ungated and grants have no arguments. Gate fs.read and fs.write for dependencies the same way. Let a grant carry arguments: a directory root for fs, a binary name for process.spawn, a host list for net. The compiler checks what it can see; the WP37 sandbox enforces the rest at run time (Landlock paths, an exec allowlist, network rules where the platform allows). The capability lockfile (WP40 §6) records the arguments. Language change: LANGUAGE.md rule, `docs/security/capabilities.md`, WP40 note, codes in `src/codes.ts`, tests in the `caps_*` and sandbox sections (a grant too narrow refused at build, the same reach stopped by the sandbox at run time), the guide's sandbox page, and the wasi and performance runs. Existing grants keep working unchanged; migration goes in the PR body.

## Out of scope

- Multicore and a draining shutdown for the handler layer (a separate piece of work; stage 4 uses a drain only if one is already on `main`).
- Any change to another open run's branches (`feature/ts-port-language/*`, `feature/break-settings-file/*`, `feature/unix-sockets/*`).
- Merging the Release PR.

## Tests

Each stage adds its own section or filter to `tests/run.js`, named after its stage and the repo's prefixes (`net_handler`, `net_http_app`, `watch`, `json_presence`, `json_merge_patch`, `crypto_jwt`, `crypto_bcrypt_pool`, `net_outbound`, `caps_`, `sandbox`), and its own `tests/link/*` programs. Postgres runs through `tests/postgres/live/run.mjs` (CI's `postgres-live` job).

## Verification

Per stage, the stage's `verification` line, plus the repo's definition of done (`CLAUDE.md`): `npm run check`, `npm run lint`, `node tests/run.js <filter>` for every section touched, `node scripts/security-scope.mjs`, and for any change to `src/` `WASI_SYSROOT=/usr node tests/run.js wasi` (read its skip line) and `node tests/run.js performance`. The full-suite gate is CI: every `test (…, shard N/4)` row green on the PR's current head, each shard's skip count read.
