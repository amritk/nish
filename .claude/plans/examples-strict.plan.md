---
name: examples-strict — every program under examples/ builds without --allow-panics
overview: 19 files under examples/ still name --allow-panics (13 smoke lines plus the two build scripts, node-addon.mjs and relay's README). Built strict at c5ed8e73 they refuse on two kinds of site - their own code (add, multi, arrays, relay, wasm-arena, break-web and src/break-*.ts) and std sites earlier panic-free stages left behind because the prover could not discharge them (module-storage indexes, #2316; a caller's proof of a constructor or contract panic, #2296). This plan lands the two prover fixes first, then clears each example and the exact std sites it reaches, then turns the stale opt-out check into a guard that refuses any new opt-out. merge-patch stays with WP80 S7 (#2356, #2369).
priority: 165
labels: []
stages:
  - id: s1-prover-storage
    title: examples-strict S1 — prove index sites into module storage (#2316)
    goal: src/bounds.ts proves an index into a module-level array or typed array whose length is a constant and whose index is bounded the same way a local's is, so wasm-arena's sim.ts and client.ts and break-web's game.ts lose their module-storage index sites without source changes.
    verification: node tests/run.js bounds && node tests/run.js link && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/self/goldens.js && NISH=build/nish bash docs/cookbook/regen.sh --check && node tests/nish-cmp.js
    todos:
      - id: s1-prove
        content: Extend src/bounds.ts (and src/attributes.ts's proven-site record) so a module-storage index is proven under the rules a local array's is; positive tests/cases program with golden .ll, a tests/link negative where the index is not bounded
        status: pending
      - id: s1-pins
        content: Regenerate checked goldens, IR_COOKBOOK, nish-cmp DECLARED entries for moved IR; read the wasi skip line and the NL9007 ratchet
        status: pending
  - id: s2-prover-caller
    title: examples-strict S2 — a caller's proof discharges a constructor or contract panic (#2296)
    goal: The caller-proof path src/attributes.ts gives std/threads.ts works for any std callee, so copyBytes (std/bytes.ts:526), url.ts:1141 and fetch.ts's window contracts are discharged at call sites whose arguments the caller proves.
    after: [s1-prover-storage]
    verification: node tests/run.js bounds && node tests/run.js link && node tests/run.js std-panics && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/self/goldens.js && NISH=build/nish bash docs/cookbook/regen.sh --check && node tests/nish-cmp.js
    todos:
      - id: s2-prove
        content: Generalise callerProven beyond std/threads.ts; a positive case and a tests/link negative where the caller does not prove the argument
        status: pending
      - id: s2-pins
        content: Regenerate goldens, cookbook, docs/reference; lower tests/std-panics.json to exact counts if any fall; nish-cmp entries
        status: pending
  - id: s3-own-small
    title: examples-strict S3 — add, multi and arrays
    goal: examples/add.ts, examples/multi and examples/arrays.ts build strict. add and square return Result<number, ...> (owner, 2026-11-27) - the C, N-API and wasm hosts read the by-value Result word / {ok, value} union, and the README shows the error arm as the overflow check. arrays' squares(-1) trap becomes a reported error with the exit code its test pins. Every host, script and test that builds them drops the flag.
    verification: node tests/run.js performance && node tests/run.js link && node tests/run.js examples && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/self/goldens.js && node tests/nish-cmp.js
    todos:
      - id: s3-fix
        content: Make add and square return a Result (checked add/mul, no cast wraps, no made-up values) and update every host that calls them (C, N-API, wasm, tests/run.js WP17-style interop sites, package.json size-report); arrays' sums and squares bounded or Result-returning, squares(-1) reported on stderr with the pinned exit code
        status: pending
      - id: s3-callers
        content: Drop --allow-panics from examples/node-addon.mjs, package.json scripts, tests/run.js builds of these programs, README and docs/guide mentions
        status: pending
  - id: s4-term
    title: examples-strict S4 — term-probe and the term std sites break-web also reaches
    goal: term-probe builds strict; std/term-pixels.ts:230 (Framebuffer.set), :157 and std/term.ts:729 are removed or proved, which also clears break-web's term-pixels calls.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js term && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/self/goldens.js && node tests/nish-cmp.js
    todos:
      - id: s4-fix
        content: Remove or prove the term-pixels and term sites (Result where failure is real, proof where unreachable, no nish:unsafe beyond wrapping*); regenerate pinned std line numbers
        status: pending
      - id: s4-optout
        content: Drop term-probe's opt-out header, smoke args and its ALLOW_PANICS build in tests/run.js; guide and docs/security record mentions (#2208)
        status: pending
  - id: s5-wasm-arena
    title: examples-strict S5 — wasm-arena client, sim and replay
    goal: client.ts (wasm32 --host) and replay.ts (--deterministic) build strict; build.mjs drops both flags.
    after: [s1-prover-storage]
    verification: node examples/wasm-arena/build.mjs && node tests/run.js performance && node tests/run.js wasm && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/self/goldens.js && node tests/nish-cmp.js --no-sidecars
    todos:
      - id: s5-fix
        content: Clear what S1 leaves in client.ts and sim.ts, and any std/math or nish:host/ring site that surfaces after; drop the headers, smoke args and build.mjs flags
        status: pending
  - id: s6-break-web
    title: examples-strict S6 — break-web game and src/break-*.ts
    goal: game.ts (wasm32 --deterministic) builds strict, with src/break-*.ts, std/raster.ts and std/random.ts:152 cleared; build.mjs drops the flag and help.ts and docs/site/break are regenerated.
    after: [s1-prover-storage, s4-term]
    verification: node examples/break-web/build.mjs --check && node tests/run.js performance && node tests/run.js break && node tests/run.js std-panics && WASI_SYSROOT=/usr node tests/run.js wasi && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/self/goldens.js && node tests/nish-cmp.js --no-sidecars
    todos:
      - id: s6-fix
        content: Remove or prove the overflow, index, array-length, slice, divide and pop sites in game.ts and src/break-*.ts (the native nish break command uses the same files) and the std/raster.ts and std/random.ts sites
        status: pending
      - id: s6-optout
        content: Drop game.ts's header and build.mjs's flag; regenerate help.ts and docs/site/break with node examples/break-web/build.mjs
        status: pending
  - id: s7-http
    title: examples-strict S7 — http-get-json and http-app
    goal: Both build strict with -o and --link; the fetch.ts, url.ts, bytes.ts and http-compress.ts sites they reach are discharged by S2 or removed.
    after: [s2-prover-caller]
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/self/goldens.js && node tests/nish-cmp.js
    todos:
      - id: s7-fix
        content: Clear std/net/fetch.ts:1894 and :900, url.ts:1141, bytes.ts:526, http-compress.ts:1150 and app.ts's own site; regenerate pinned std line numbers
        status: pending
      - id: s7-optout
        content: Drop both examples' headers and smoke args, guide mentions and their tests/run.js ALLOW_PANICS builds
        status: pending
  - id: s8-relay-std
    title: examples-strict S8 — the std sites relay reaches (HTTP/3, QPACK, WebSocket, WebTransport, hmac, sha256, base64url)
    goal: The std sites relay's calls reach are removed or proved - net/http3-frame.ts:357, http3-server.ts:906/831/1106, qpack.ts:516, websocket.ts:287, webtransport.ts:758, crypto/hmac.ts:636, sha256.ts:528, base64url.ts:182/443, and any that surface after.
    verification: node tests/run.js std-panics && node tests/run.js instructions && node tests/run.js performance && node tests/run.js net && node tests/run.js crypto && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/gen-reference.mjs --check && node tests/self/goldens.js && node tests/nish-cmp.js
    todos:
      - id: s8-fix
        content: Remove or prove the sites; secret intermediates stay Secret and wiped; rerun vector check and mutate on any spec'd module touched; update docs/security records whose counts change
        status: pending
  - id: s9-relay
    title: examples-strict S9 — relay's own code
    goal: examples/relay builds strict - its ~320 own sites (parsers become Result-returning, indexes proven, overflow bounded) and its four deliberate pinned panics become Results reported on stderr with the exit codes their tests pin (owner, 2026-11-27); README drops the flag.
    after: [s8-relay-std]
    verification: node tests/run.js relay && node tests/run.js performance && node tests/run.js link && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node tests/self/goldens.js && node tests/nish-cmp.js
    todos:
      - id: s9-fix
        content: Clear relay.ts, json.ts, frame.ts, peers.ts, options.ts, identity.ts and main.ts; keep relay's tests' observable behaviour, each of the four deliberate panics now a reported error with its pinned exit code, tests re-pinned on the message only
        status: pending
  - id: s10-guard
    title: examples-strict S10 — refuse a new opt-out under examples/
    goal: tests/run.js fails when any file under examples/ (smoke line, build script, README) names --allow-panics, except an allowlist that only shrinks (merge-patch until WP80 S7 lands); the stale opt-out check folds into it.
    after: [s3-own-small, s4-term, s5-wasm-arena, s6-break-web, s7-http, s9-relay]
    verification: node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs
    todos:
      - id: s10-guard
        content: Replace the stale-opt-out loop with a guard plus a shrinking allowlist; a check that fails when the guard is removed; AGENTS.md / docs/guide note on the rule
        status: pending
---

# examples-strict

## Why

The no-panic default applies to every root package, and the examples are what a
reader copies. 19 files under `examples/` still name `--allow-panics`. Earlier
panic-free work packages (WP80, WP82, WP85) closed with these left over because
two prover gaps (#2316, #2296) blocked the last sites, and the examples with
their own deliberate overflow (add, multi, arrays) were recorded as "keep".

## Strict probe at c5ed8e73

| Example | Refusals | Where |
| --- | --- | --- |
| add.ts | 1 | own `a + b` |
| multi/main.ts | 1 | own `n * n` in math.ts |
| arrays.ts | 4 | own overflow ×3, array-length |
| term-probe.ts | 2 | term-pixels.ts:230, term.ts:729 |
| http-get-json.ts | 4 | fetch.ts:1894 ×2, :900, url.ts:1141 |
| http-app/main.ts | 18 | bytes.ts:526 ×16, http-compress.ts:1150, own app.ts |
| wasm-arena client / replay | 120 / 113 | module-storage indexes in client.ts and sim.ts (#2316) |
| break-web game.ts | 336 | game.ts module storage (#2316), src/break-*.ts, raster, term-pixels:157, random:152 |
| relay/main.ts | 329 | own parsers ~290, http3/qpack/websocket/webtransport/hmac/sha256/base64url |
| merge-patch.ts | 1 (--link) | out of scope: WP80 S7 (#2356, #2369, awaiting decision) |

NL2458 names only the first site per call, so a stage expects more sites after
each fix; the probe is a floor, not the scope.

## Owns

**Shared files.** `tests/run.js`, `tests/nish-cmp.js`, `tests/std-panics.json`,
`scripts/smoke.sh`, `scripts/wrap-casts.txt`, `docs/guide/**`, `docs/wp*.md`,
`README.md` and `std/README.md` name several stages' examples or modules. A
stage edits only the lines about its own examples and std sites in them; a
conflict there is resolved when the stage merges `main`, by recomputing (counts,
DECLARED entries) and never by taking one side. Regenerated files (checked
goldens, `docs/reference/**`, `docs/IR_COOKBOOK.md`, pinned
`std/<file>.ts:LINE:COL` in `tests/link/*/expected.*`, `tests/wordings/*.err`,
`docs/reference/diagnostics/`) are regenerated, never hand-merged.

**Sensitive paths (CODEOWNERS).** S3 edits `.github/workflows/ci.yml` (line 771
builds add with the flag), `.github/workflows/release.yml` (the multi build) and
`package.json` (`example`, `size-report`); S10 edits `AGENTS.md`. Both are built
and reviewed, then left green for the owner to merge.

- **S1** `src/bounds.ts`, `src/attributes.ts`, new `tests/cases/*storage*`, new `tests/link/*storage*`
- **S2** `src/bounds.ts`, `src/attributes.ts` (after S1), new `tests/cases/*caller*`, new `tests/link/*caller*`
- **S3** `examples/add.ts`, `examples/main.c`, `examples/multi/**`, `examples/arrays.ts`, `examples/node-addon.mjs`, `scripts/size-report.sh`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `package.json`, `docs/guide/using-nish/interop.md`, `docs/wp50-wasm-host.md`
- **S4** `std/term-pixels.ts`, `std/term.ts`, `examples/term-probe.ts`, `docs/guide/using-nish/terminal.md`, `docs/security/term*.md`
- **S5** `examples/wasm-arena/**`, `tests/interop/chrome-arena.py`, `tests/runtime-budgets.js` (arena rows), any `std/math.ts` site that surfaces
- **S6** `examples/break-web/**`, `src/break-*.ts`, `std/raster.ts`, `std/random.ts`, `docs/site/break/**`, `tests/break-web/**`
- **S7** `std/net/fetch.ts`, `std/net/url.ts`, `std/bytes.ts`, `std/net/http-compress.ts`, `examples/http-get-json.ts`, `examples/http-app/**`, `tests/link/net_http_app/**`, `docs/security/{handler,router,static}.md`, `docs/guide/using-nish/api-server.md`
- **S8** `std/net/http3-*.ts`, `std/net/qpack.ts`, `std/net/websocket.ts`, `std/net/webtransport.ts`, `std/crypto/{hmac,sha256,base64url}.ts`, `docs/security/http3.md` and the crypto/websocket records whose counts change, `contracts/**` and `test/spec/**` for those modules
- **S9** `examples/relay/**`, `tests/link/net_relay*/**`, `docs/guide/using-nish/networking.md`
- **S10** the stale opt-out block of `tests/run.js` (~6577), `AGENTS.md`

**Waves.** First: S1, S3, S4, S8 (disjoint). Then S2 (after S1), S5 (after
S1), S6 (after S1, S4), S9 (after S8), S7 (after S2), S10 last. No stage runs on
Sonnet: each one designs a proof, a Result or a prover rule.

## Rules (from WP80, binding on every stage)

1. No `nish:unsafe` except `wrappingAdd/Sub/Mul` where wrapping is the answer.
2. No made-up-value guards: a `Result` where the failure is real, a proof where it is unreachable.
3. A wrap is spelled, never cast.
4. Pinned std line numbers, goldens, docs/reference regenerated in the same PR.
5. `tests/std-panics.json` lowered to exact counts; no `bench/instructions.json` count may rise (CI figures only).
6. A refused↔compiled flip adds `file: "exit"` nish-cmp entries.

## Decisions (owner, 2026-11-27)

- Signed off with autonomous merge on green CI; report handed over as a file.
- add and multi: return a `Result` (the export ABI carries it to C, N-API and wasm); not narrowed inputs, not wrapping, not kept opted out.
- Deliberate traps (arrays' `squares(-1)`, relay's four): a `Result` reported on stderr, same exit code, tests re-pin the message.

## Acceptance criteria

- A1. Every program under `examples/` except merge-patch builds with `-o` and `--link` (and its build script's target flags) without `--allow-panics`.
- A2. `grep -r -- --allow-panics examples/` finds only merge-patch's lines and the S10 allowlist names only merge-patch.
- A3. `tests/run.js` holds no `ALLOW_PANICS` build of an `examples/` program, and S10's guard fails when an opt-out is added back.
- A4. Every example's smoke output (stdout, exit) and each pinned test of it is unchanged, except: add/square's hosts read a Result, and the deliberate traps (arrays' squares(-1), relay's four) keep their exit codes with a reported message instead of a panic.
- A5. No `bench/instructions.json` count rose; `tests/std-panics.json` fell or held per module.
- A6. #2316 and #2296 close with S1 and S2.
