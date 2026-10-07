---
name: Issue sweep — fix the open issues that can be fixed, one PR at a time
overview: Fourteen open issues on amritk/nish that need no owner decision and do not overlap the in-flight wp34-stack run, each fixed in its own PR, strictly in sequence — each stage starts from main after the previous one merged.
stages:
  - id: cli-fix-target
    title: "fix(cli): refuse --target together with --fix"
    goal: nish --fix refuses every flag that only shapes the IR, --target included, with exit 2 (#433)
    verification: npm run check && npm test && npm run test:cli
    todos:
      - id: fix-target-refusal
        content: Make the --fix refusal in src/compile.ts cover notForRun flags as well as productFlag — see cli-fix-target
        status: pending
      - id: fix-target-test
        content: Pin the refusal in tests/nish/cli.ts beside checkFixField — see cli-fix-target
        status: pending
  - id: resolver-dup
    title: "fix(cli): report a missing Nish entry point once per import"
    goal: One import of a package whose exports has no nish condition yields one diagnostic, not two (#434)
    verification: npm run check && npm test
    todos:
      - id: dup-root-cause
        content: Find why src/manifest.ts reports has no Nish entry point twice and report it once — see resolver-dup
        status: pending
      - id: dup-negative-test
        content: Add a negative test pinning exactly one diagnostic and the 1 error summary — see resolver-dup
        status: pending
  - id: arena-tests
    title: "test(net): move net_http1 and net_websocket off Arena.mark/Arena.release"
    goal: No test program calls the deprecated Arena.mark/Arena.release (#446)
    verification: npm run check && node tests/run.js net_http1 net_websocket && npm test
    todos:
      - id: arena-migrate
        content: Replace the mark/release brackets in tests/link/net_http1/checks.ts and tests/link/net_websocket/checks.ts with using a = arena(), or document the NL2424 refusal — see arena-tests
        status: pending
  - id: security-readme
    title: "docs(security): recompute the README rows and Total from the records"
    goal: Every Areas row, the Total row and the Open findings table of docs/security/README.md match the records (#439)
    verification: node docs/check-links.mjs && npm test
    todos:
      - id: readme-recount
        content: Recount every area record and rewrite the README rows, Total, Open findings and footnotes — see security-readme
        status: pending
      - id: readme-stale-refs
        content: Fix the stale CG-3 Open in runtime.md and the Fixed (#382) attribution in codegen.md — see security-readme
        status: pending
  - id: overflow-docs
    title: "docs: describe checked signed overflow everywhere the old nsw default is still claimed"
    goal: No doc claims signed overflow is nsw or undefined by default (#453 F1, and F2 if the bench harness runs)
    verification: node docs/check-links.mjs && docs/cookbook/regen.sh --check && npm test
    todos:
      - id: overflow-prose
        content: Rewrite the prose listed in #453 F1 and mark the plan and record docs superseded by #426 — see overflow-docs
        status: pending
      - id: overflow-bench
        content: Regenerate docs/BENCHMARKS.md with node bench/run.mjs only if the C, Rust and Go baselines all run — see overflow-docs
        status: pending
  - id: hoist-new-resize
    title: "fix(codegen): do not hoist a loop's array header across a new whose constructor resizes it"
    goal: The #435 reproducer prints 706 like Node, and IR moves only for loops whose constructor really resizes (#435)
    verification: npm run check && npm test && node tests/self/goldens.js
    todos:
      - id: hoist-test-first
        content: Add the #435 reproducer as a failing-first tests/cases golden with expected stdout — see hoist-new-resize
        status: pending
      - id: hoist-fix
        content: Make callMayResize in src/emit-arrays.ts treat a class new as a call to its constructor, folding rightSideMayResize in if it fits — see hoist-new-resize
        status: pending
      - id: hoist-record
        content: Add the docs/security/codegen.md row and the README count — see hoist-new-resize
        status: pending
  - id: nonexported-method
    title: "fix(checker): a method of a non-exported std class called from another package links or is refused"
    goal: The #442 shape either links and runs, or is refused by the checker with a diagnostic naming the class — never an undefined symbol at link (#442)
    verification: npm run check && npm test && node tests/self/goldens.js
    todos:
      - id: nonexported-repro
        content: Reproduce the undefined symbol with a minimal tests/link program — see nonexported-method
        status: pending
      - id: nonexported-fix
        content: Fix the emitted visibility, or refuse in the checker with a coded diagnostic, whichever is sound — see nonexported-method
        status: pending
  - id: owner-checks
    title: "fix(cli): check the owner of the run cache root and the package root, and take the first executable nish on PATH"
    goal: CLI-7 and CLI-9 are fixed using the builtins 0.17.0 ships (#486)
    verification: npm run check && npm test && npm run test:cli
    todos:
      - id: owner-seed-check
        content: Confirm the 0.17.0 seed carries lstatOwnerModeSync, geteuid and isExecutableSync before using them — see owner-checks
        status: pending
      - id: owner-run-cache
        content: Refuse a nish run cache root owned by another user or group/world-writable with a coded diagnostic — see owner-checks
        status: pending
      - id: owner-package-root
        content: Owner-check the package root in packageRootCandidates and make programOnPath skip a non-executable nish — see owner-checks
        status: pending
      - id: owner-record
        content: Mark CLI-7 and CLI-9 fixed in docs/security/cli.md and the README counts — see owner-checks
        status: pending
  - id: x509-random
    title: "feat(crypto): a native-only helper that draws the key and serial for x509MintSelfSigned"
    goal: X509-6 is closed with a std/crypto/x509-random module that x509.ts does not import (#385)
    verification: npm run check && npm test
    todos:
      - id: x509-random-module
        content: Add std/crypto/x509-random.ts drawing the P-256 key as a Secret and the serial from crypto.getRandomValues — see x509-random
        status: pending
      - id: x509-random-tests
        content: Add a tests/link case and a wasm32 refusal check, and mark X509-6 fixed — see x509-random
        status: pending
  - id: tls-res-master
    title: "feat(net): derive the TLS resumption master secret, completing RFC 8448 §3"
    goal: tests/link/net_tls_rfc8448 pins res master against RFC 8448 §3, and the secret is wiped or recorded under TLS-1 (#445)
    verification: npm run check && node tests/run.js net_tls && npm test
    todos:
      - id: res-master-derive
        content: Derive res master in std/net/tls.ts after the client Finished is accepted — see tls-res-master
        status: pending
      - id: res-master-pin
        content: Pin 7df235f2… in net_tls_rfc8448 and its f64 twin, and update TLS-1 in docs/security/tls.md — see tls-res-master
        status: pending
  - id: k1-remainder
    title: "feat(crypto): run Wycheproof for HMAC and HKDF, and wipe their state"
    goal: HMAC-SHA256/384/512 and HKDF-SHA256/384 pass Wycheproof, and HMAC and HKDF wipe their pads and PRK (#476)
    verification: npm run check && node tests/run.js crypto_ && npm test
    todos:
      - id: k1-wycheproof
        content: Add the Wycheproof HMAC and HKDF vectors under tests/link/crypto_wycheproof — see k1-remainder
        status: pending
      - id: k1-wipe
        content: Wipe HMAC pads and HKDF PRK with wipe, accept Secret keys where the caller holds one, and pin the wipe under -O2 — see k1-remainder
        status: pending
  - id: fix-followups-461
    title: "fix(checker): the diagnostic-fix-2 follow-ups — NL9007 wording, uncheckedGet in the range analysis, one-round migration"
    goal: Items 2, 3 and 4 of #461 are done; item 1 (unsafe-wrap) is untouched
    verification: npm run check && npm test && node tests/self/goldens.js
    todos:
      - id: f461-nl9007
        content: Reword NL9007 or credit an unsigned upper-bound guard, with a fix for the u8/u16/u32 shapes — see fix-followups-461
        status: pending
      - id: f461-unchecked
        content: Teach src/bounds.ts that uncheckedGet and uncheckedSet are plain array reads and writes — see fix-followups-461
        status: pending
      - id: f461-small
        content: Add sink.reportDeprecationFix, treat identical edits as applied in acceptedEdits, and record flag-proven facts — see fix-followups-461
        status: pending
  - id: fix-followups-440
    title: "feat(checker): fixes for !xs.length and non-boolean && / || operands, and code-checked nofix cases"
    goal: Items 3 and 4 of #440 are done; items 1 and 2 are untouched
    verification: npm run check && npm test
    todos:
      - id: f440-truthiness
        content: Attach the === 0 / !== 0 fix to NL2263 and NL2099 where it is safe, with tests/fix cases — see fix-followups-440
        status: pending
      - id: f440-nofix-code
        content: Give tests/fix nofix cases an expected-code sidecar that tests/run.js checks — see fix-followups-440
        status: pending
  - id: ct13
    title: "test(ct): settle CT-13 with in-domain inputs to ladderStep"
    goal: CT-13 in docs/security/ct-verification.md is decided — real leak located, or the harness constrained to the module's domain with the reason recorded (#378)
    verification: npm run check && npm test
    todos:
      - id: ct13-measure
        content: Re-run tests/ct-timing.js with reduced limbs and a 0/1 swap, full driver and linked alone, and record the readings — see ct13
        status: pending
      - id: ct13-decide
        content: Constrain the harness inputs or locate the instruction, and update CT-13 — see ct13
        status: pending
---

## Context

Thirty-four issues are open on `amritk/nish`. This run takes the fourteen that can be fixed without an owner decision and that stay clear of the files the in-flight `wp34-stack` run (#463, PRs #487–#492) is changing. Left out: #389 (a repository setting), #382 and #357 (nearly done; close after checking), #430, #432, #440 item 2 and #461 item 1 (each needs a decision first), #447, #472–#474 and #478–#485 (WP34 features), #358 (macOS CI) and #475 (benchmark toolchains).

## Approach

- **Strictly sequential.** `--max-slices 1`. Each stage depends on the one before it, and starts from `main` after that one merged. This was asked for, and it also sidesteps the regenerated-golden conflicts (`tests/self/goldens/checked*.txt`) that every `src/` change causes.
- **Every stage obeys CLAUDE.md:** the rolling freeze (`src/` uses no construct the 0.17.0 seed lacks), goldens regenerated with `node tests/self/goldens.js --update`, never hand-edited, the exact LLVM IR in the PR body for every TypeScript snippet added to tests, and a conventional commit whose subject and body are the changelog entry.
- **Closing.** A PR body says `Fixes #N` only when it closes the whole issue. For a partial fix (#461, #440, and #453 if F2 can't run here), it says `Refs #N` and lists what is left.
- **A stage that turns out to be impossible as written** goes up as a draft PR that says what blocked it. It does not substitute other work.

## cli-fix-target

**Owns:** `src/compile.ts`, `tests/nish/cli.ts`, `tests/self/goldens/**`, `docs/LANGUAGE.md`

The `--fix` refusal at `src/compile.ts` (~699) checks only `productFlag`. Refuse `notForRun` flags too (`--target` and any other flag that only shapes the IR), with the same message and exit 2. Pin the refusal in `tests/nish/cli.ts` beside `checkFixField`.

## resolver-dup

**Owns:** `src/manifest.ts`, `src/compilation.ts`, `src/packages.ts`, `tests/link/**` (new case only), `tests/cases/**` (new case only), `tests/self/goldens/**`

Repro from #434: `node_modules/dep` with `"exports": { ".": { "default": "./index.js" } }`, plus `import { x } from "dep"`. Find the second report (probably two resolution passes, or two candidate conditions) and dedupe at the source, not in the printer. Add a negative test that expects exactly one diagnostic and `1 error`.

## arena-tests

**Owns:** `tests/link/net_http1/**`, `tests/link/net_websocket/**`
**Model:** sonnet

Replace the `Arena.mark()`/`Arena.release(mark)` brackets (`net_http1/checks.ts` ~193–196, `net_websocket/checks.ts` ~147–149) with a `using a = arena()` block. Keep the measurement each one makes: parsing allocates nothing that outlives the loop. If NL2424 refuses the block because a callee stores an allocation, keep the test's intent some other way and say why in a comment.

## security-readme

**Owns:** `docs/security/README.md`, `docs/security/runtime.md`, `docs/security/codegen.md`
**Model:** sonnet

Recount every record under `docs/security/` by severity and state, rewrite each Areas row, then sum the Total row from those rows. Prune "Open findings" and the footnotes to match. Also: `runtime.md` (~110) "CG-3 (rest)" is Fixed by #427, and `codegen.md`'s "Fixed (#382)" should name #427. Change documentation only. Verify the current state first, because #439 may be partly stale.

## overflow-docs

**Owns:** `README.md`, `docs/IR_COOKBOOK.md` (prose only, not generated blocks), `docs/FAQ.md`, `docs/MASTER_PLAN.md`, `docs/wp*.md`, `docs/security/crypto-ecc.md`, `docs/BENCHMARKS.md`
**Model:** sonnet

Work through #453's F1 list. Check each line against `main` first, because some (e.g. FAQ) are already fixed. In plan and record docs, add a "superseded by #426" note rather than rewriting history. F2: regenerate `docs/BENCHMARKS.md` with `node bench/run.mjs` only if C, Rust and Go all run in the container. Otherwise leave the page alone and say so in the PR (`Refs #453`, not `Fixes`).

## hoist-new-resize

**Owns:** `src/emit-arrays.ts`, `src/attributes.ts`, `tests/cases/**` (new case + moved goldens), `tests/nish-cmp.js`, `tests/self/goldens/**`, `docs/security/codegen.md`, `docs/security/README.md`, `docs/IR_COOKBOOK.md`

Add the #435 program as a failing-first golden (Node prints 706). In `callMayResize`, treat a class `new` like a call to `@C.constructor`, using its fixpoint `resizesArray` fact. Fold `rightSideMayResize` (CG-10) into it if that comes out cleanly. Only the IR of loops whose constructor really resizes may move. List every golden that moves in the PR body, with the reason. Add a codegen.md row (next CG number) and update the README count.

## nonexported-method

**Owns:** `src/checker.ts`, `src/members.ts`, `src/visibility.ts`, `src/emit-classes.ts`, `src/symbols.ts`, `src/codes.ts`, `docs/LANGUAGE.md`, `tests/link/**` (new case only), `tests/cases/**` (new case only), `tests/self/goldens/**`

Reproduce it with a minimal std-like package with an exported function that returns a non-exported class's value, then call a method on it from another package. Then pick the sound fix. Linking it (emit the method with linkage the caller can reach) is preferred if a non-exported class's value reaching another package is already legal. Refusing with a coded diagnostic (via `scripts/gen-diagnostic-codes.mjs`) is preferred if the language rule says it should not be reachable. Name the rule in LANGUAGE.md either way.

## owner-checks

**Owns:** `src/compile.ts`, `src/run-cache.ts`, `src/compilation.ts`, `src/codes.ts`, `tests/nish/cli.ts`, `tests/self/goldens/**`, `docs/security/cli.md`, `docs/security/README.md`, `docs/LANGUAGE.md`

First check that `build/seed/bin/nish` (0.17.0) compiles a program calling `lstatOwnerModeSync`, `geteuid` and `isExecutableSync`. If it does not, stop with a draft PR, because the rolling freeze forbids the change. Then: `runProgram` refuses a cache root not owned by `geteuid()` or group/world-writable, with a coded diagnostic. `packageRootCandidates` owner-checks the same way. `programOnPath` takes the first *executable* `nish`. Mark CLI-7 and CLI-9 fixed and update the README counts.

## x509-random

**Owns:** `std/crypto/x509-random.ts` (new), `std/crypto/x509.ts` (comment only), `tests/link/crypto_x509_random/**` (new), `docs/security/crypto-x509.md`, `docs/security/README.md`, `docs/LANGUAGE.md`, `package.json` (exports only)

A native-only module that draws a P-256 private key (as `Secret<u8[]>`, rejection-sampled into range) and a positive 20-byte serial from `crypto.getRandomValues`, then calls `x509MintSelfSigned`. `x509.ts` itself must not import it, so wasm32 programs that use x509 still compile. Tests: the minted certificate parses and verifies, two mints differ, and a wasm32 build importing the helper is refused. Mark X509-6 fixed.

## tls-res-master

**Owns:** `std/net/tls.ts`, `tests/link/net_tls_rfc8448/**`, `tests/link/net_tls_rfc8448_f64/**`, `docs/security/tls.md`, `docs/security/README.md`

After the client Finished is accepted, compute `tlsDeriveSecret(h, master, "res master", transcriptHash(ClientHello..client Finished))`. Expose it the way the other secrets are exposed to the test. Pin RFC 8448 §3's value (`7df235f2…`) in both twins. Under CLAUDE.md's Security rule, wipe it when the connection is done, or record it under TLS-1 for as long as it is held. NewSessionTicket, PSK and 0-RTT stay out. Before starting, check that no open `wp34-stack` PR touches `std/net/tls.ts`.

## k1-remainder

**Owns:** `std/crypto/hmac.ts`, `std/crypto/hkdf.ts`, `tests/link/crypto_wycheproof*/**`, `tests/link/crypto_hmac*/**`, `tests/link/crypto_hkdf*/**`, `tests/run.js` (the -O2 wipe pin only), `THIRD_PARTY_NOTICES.md`, `docs/security/crypto-*.md`, `docs/security/README.md`

Item 1: add Wycheproof's HMAC-SHA256/384/512 and HKDF-SHA256/384 vectors the way `crypto_wycheproof` carries K2/K3/K5. Keep their notice in `THIRD_PARTY_NOTICES.md` (`.claude/licensing.md`). Item 2: have HMAC and HKDF wipe their inner and outer pads and the PRK before returning, and accept a `Secret<u8[]>` key through an additional entry point where the caller holds one. Do not break the existing plain-array callers in `std/net`; their move belongs to #430. Pin the wipe under `-O2`, as `secret_wipe_o2` does.

## fix-followups-461

**Owns:** `src/bounds.ts`, `src/ranges.ts`, `src/diagnostics.ts`, `src/fix.ts`, `src/unsafe-migrate.ts`, `src/panics.ts`, `src/codes.ts`, `tests/cases/**`, `tests/fix/**`, `tests/link/unsafe-migrate-*/**`, `tests/nish-cmp.js`, `tests/self/goldens/**`, `docs/LANGUAGE.md`, `docs/AI.md`

#461 item 2: reword NL9007's "an unsigned index needs only the upper one", or credit that guard and give it a fix. The worker picks whichever is sound, and the PR says which. Item 3: `bounds.ts` treats `uncheckedGet`/`uncheckedSet` as array reads and writes, not opaque calls. Pin it with the `a[at[0]] + b[at[1]]` shape, migrated in one `--fix` round. Item 4: add `sink.reportDeprecationFix`; make `acceptedEdits` treat an identical edit as applied; make the flag build record the facts it would have proven. Item 1 (unsafe-wrap) stays out.

## fix-followups-440

**Owns:** `src/fix.ts`, `src/checker.ts`, `src/expressions.ts`, `src/statements.ts`, `src/diagnostics.ts`, `tests/fix/**`, `tests/run.js` (tests/fix runner only), `tests/self/goldens/**`, `docs/AI.md`, `docs/LANGUAGE.md`

Item 3: `!xs.length` → `xs.length === 0` (NL2263), and a non-boolean `&&`/`||` operand `s.length && …` → `s.length !== 0 && …` (NL2099). Fix only where the rewrite keeps the meaning. Otherwise there is no fix, pinned by a nofix case. Item 4: each `*.nofix.ts` gets an expected-code sidecar, and the runner checks that the diagnostic it was written for is the one that fired. Items 1 and 2 stay out.

## ct13

**Owns:** `tests/ct-timing.js`, `tests/ct-timing/**`, `tests/cases/ct_asm_x25519*`, `docs/security/ct-verification.md`, `docs/security/README.md`, `std/crypto/x25519.ts` (only if a real leak is found)

Feed `ladderStep` reduced 25.5-bit limbs and a 0/1 `swap`, in the full seven-function driver and linked alone, at 300,000 samples, several runs each. Record the |t| readings and the CPU. If the gap disappears, constrain the harness to the domain and record why. If it persists, locate the instruction responsible (perf/llvm-mca/disassembly) and fix `x25519.ts`, or record precisely what was found and keep CT-13 open (`Refs #378`). The weekly CI reading is a second machine. Cite it if one exists.

## Acceptance criteria

1. `nish foo.ts --fix --target wasm32-wasi` exits 2 with the "cannot be used with --fix" message and leaves `foo.ts` unchanged (#433).
2. One import of a package with no `nish` exports condition prints the "has no Nish entry point" error once and summarises `1 error` (#434).
3. `git grep "Arena\.\(mark\|release\)" tests/` finds nothing, and `node tests/run.js net_http1 net_websocket` passes (#446).
4. Every Areas row of `docs/security/README.md` matches a recount of its record, and the Total row is their sum (#439).
5. No README, cookbook prose, FAQ or current-tense doc says signed overflow is `nsw` or undefined by default. `docs/BENCHMARKS.md` is regenerated, or the PR says why it could not be (#453).
6. The #435 program prints `706` from a native build (#435).
7. The #442 shape either links and prints its result, or is refused at check time by a coded diagnostic that names the class. It never fails at link (#442).
8. `nish run` refuses a cache root that is world-writable or owned by another user, with a coded diagnostic. A non-executable `nish` earlier on `PATH` is skipped. `cli.md` marks CLI-7 and CLI-9 fixed (#486).
9. A native program using the new x509-random helper mints two distinct certificates that each parse and verify, and a wasm32 build importing it is refused. X509-6 is marked fixed (#385).
10. `net_tls_rfc8448` checks `resumption_master_secret` = RFC 8448 §3's value byte for byte (#445).
11. Wycheproof HMAC-SHA256/384/512 and HKDF-SHA256/384 run in `npm test` with every vector agreeing, and a test pins that HMAC's/HKDF's wipe survives `-O2` (#476).
12. NL9007's message offers no guard spelling that fails to compile or to be credited. Migrating `a[at[0]] + b[at[1]]` reaches its fixed point in one `--fix` round (#461 items 2–4).
13. `nish --fix` rewrites `!xs.length` and `s.length && …` to explicit comparisons, and a nofix case whose expected code differs from the fired one fails `npm test` (#440 items 3–4).
14. CT-13 in `docs/security/ct-verification.md` states in-domain readings and a decision (#378).
15. On `main` after the last merge, `npm run check` and an undegraded `npm test` are green.

## Out of scope

The issues listed under Context. Nothing in `std/net/**` other than `tls.ts`'s res master. No change to the Release PR flow. No coverage or threshold configuration.

## Verification

Every stage: `npm run check`, an undegraded `npm test` (read the skip count), `npm run lint && npm run lint:dead`, `node docs/check-links.mjs`, plus the stage's own line. Any `src/` change also runs `node tests/self/goldens.js` (regenerate with `--update`, then read the diff) and `node scripts/gen-diagnostic-codes.mjs --check` when a code is added.
