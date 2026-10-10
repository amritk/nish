---
name: Issue sweep 2 — the fixable open issues, in two lanes
overview: "Continues the issue-sweep run (#494), which closed at its deadline with nine stages unstarted, and adds #524 and #503. Compiler stages run one at a time in lane A, since every src/ change moves the goldens. Std, test and doc stages run in parallel beside it in lane B. A last stage recounts docs/security/README.md once every record has moved."
stages:
  - id: hoist-new-resize
    title: "fix(codegen): do not hoist a loop's array header across a new whose constructor resizes it"
    goal: "The #435 reproducer prints 706 like Node, and IR moves only for loops whose constructor really resizes (#435)"
    verification: npm run check && npm test && node tests/self/goldens.js
    todos:
      - id: hoist-test-first
        content: "Add the #435 reproducer as a failing-first tests/cases golden with expected stdout — see hoist-new-resize"
        status: pending
      - id: hoist-fix
        content: Make callMayResize in src/emit-arrays.ts treat a class new as a call to its constructor, folding rightSideMayResize in if it fits — see hoist-new-resize
        status: pending
      - id: hoist-record
        content: Add the docs/security/codegen.md row (README counts are left to security-readme) — see hoist-new-resize
        status: pending
  - id: nonexported-method
    title: "fix(checker): a method of a non-exported std class called from another package links or is refused"
    goal: "The #442 shape either links and runs, or is refused by the checker with a diagnostic naming the class, and never fails with an undefined symbol at link (#442)"
    verification: npm run check && npm test && node tests/self/goldens.js && node scripts/gen-diagnostic-codes.mjs --check
    todos:
      - id: nonexported-repro
        content: Reproduce the undefined symbol with a minimal tests/link program — see nonexported-method
        status: pending
      - id: nonexported-fix
        content: Fix the emitted visibility, or refuse in the checker with a coded diagnostic, whichever is sound — see nonexported-method
        status: pending
  - id: owner-checks
    title: "fix(cli): check the owner of the run cache root and the package root, and take the first executable nish on PATH"
    goal: CLI-7 and CLI-9 are fixed with the owner and mode builtins the seed ships (#486)
    verification: npm run check && npm test && npm run test:cli && node tests/self/goldens.js
    todos:
      - id: owner-seed-check
        content: Confirm the seed in build/seed carries lstatOwnerModeSync, geteuid and isExecutableSync before using them — see owner-checks
        status: pending
      - id: owner-run-cache
        content: Refuse a nish run cache root owned by another user, or group- or world-writable, with a coded diagnostic — see owner-checks
        status: pending
      - id: owner-package-root
        content: Owner-check the package root in packageRootCandidates and make programOnPath skip a non-executable nish — see owner-checks
        status: pending
      - id: owner-record
        content: Mark CLI-7 and CLI-9 fixed in docs/security/cli.md — see owner-checks
        status: pending
  - id: fix-followups-461
    title: "fix(checker): the diagnostic-fix-2 follow-ups — NL9007 wording, uncheckedGet in the range analysis, one-round migration"
    goal: "Items 2, 3 and 4 of #461 are done, and item 1 (unsafe-wrap) is untouched"
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
    goal: "Items 3 and 4 of #440 are done, and items 1 and 2 are untouched"
    verification: npm run check && npm test && node tests/self/goldens.js
    todos:
      - id: f440-truthiness
        content: Attach the === 0 / !== 0 fix to NL2263 and NL2099 where it is safe, with tests/fix cases — see fix-followups-440
        status: pending
      - id: f440-nofix-code
        content: Give tests/fix nofix cases an expected-code sidecar that tests/run.js checks — see fix-followups-440
        status: pending
  - id: join-same-pass
    title: "perf(codegen): release a loop pass whose own string goes to a parts + join callee"
    goal: A string built in the same loop pass and passed to a parts + join callee no longer keeps the pass's arena (#503)
    verification: npm run check && npm test && node tests/self/goldens.js && node bench/run.mjs --check
    todos:
      - id: join-golden-first
        content: Add the failing-first golden with the argument built inside the loop and a flat Arena.used() over 1,000 passes — see join-same-pass
        status: pending
      - id: join-fix
        content: Teach src/attributes.ts that a parameter reaching only a local parts.push that is joined and dropped is not captured — see join-same-pass
        status: pending
      - id: join-evidence
        content: "Keep the #500 negative cases off, and report breadth across std/ and src/, the self-build, and bench --check — see join-same-pass"
        status: pending
  - id: index-of-any-offset
    title: "test(std): compare indexOfAny's non-ASCII byte offset between native and --profile wasi"
    goal: The non-ASCII edge of indexOfAny is checked for where it matches, not only whether, wherever two runs count the same unit (#524)
    verification: npm run check && node tests/run.js std_text_index_of_any && npm test
    todos:
      - id: ioa-offset
        content: Print the non-ASCII byte offsets on a line that runs natively and under --profile wasi but stays out of the Node comparison — see index-of-any-offset
        status: pending
  - id: x509-random
    title: "feat(crypto): a native-only helper that draws the key and serial for x509MintSelfSigned"
    goal: X509-6 is closed by a std/crypto/x509-random module that x509.ts does not import (#385)
    verification: npm run check && node tests/run.js crypto_x509 && npm test
    todos:
      - id: x509-random-module
        content: Add std/crypto/x509-random.ts, which draws the P-256 key as a Secret and the serial from crypto.getRandomValues — see x509-random
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
        content: Derive res master in std/net/tls.ts once the client Finished is accepted — see tls-res-master
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
        content: Add the Wycheproof HMAC and HKDF vectors under tests/link/crypto_wycheproof* — see k1-remainder
        status: pending
      - id: k1-wipe
        content: Wipe the HMAC pads and the HKDF PRK, accept Secret keys where the caller holds one, and pin the wipe under -O2 — see k1-remainder
        status: pending
  - id: ct13
    title: "test(ct): settle CT-13 with in-domain inputs to ladderStep"
    goal: CT-13 in docs/security/ct-verification.md is decided — a real leak located, or the harness held to the module's domain with the reason recorded (#378)
    verification: npm run check && npm test
    todos:
      - id: ct13-measure
        content: Re-run tests/ct-timing.js with reduced limbs and a 0/1 swap, in the full driver and linked alone, and record the readings — see ct13
        status: pending
      - id: ct13-decide
        content: Constrain the harness inputs or locate the instruction, and update CT-13 — see ct13
        status: pending
  - id: security-readme
    title: "docs(security): recount the README rows after the sweep"
    goal: Every Areas row, the Total row and the Open findings of docs/security/README.md match the records as merged
    verification: node docs/check-links.mjs && npm run lint
    todos:
      - id: readme-recount-2
        content: Recount every record under docs/security/ by severity and state, then rewrite the Areas rows, Total, Open findings and footnotes — see security-readme
        status: pending
---

## Context

Forty issues are open on `amritk/nish`. The previous sweep (#494) merged five stages, then reached its deadline with nine never started. Its closing comment says a new run can start at `hoist-new-resize`. All nine are still open on `main` @ f33139a. This run takes them, adds #524 (the WP38 acceptance follow-up) and #503 (the `json-arena-release` follow-up), and ends with a README recount.

Left out, unchanged from #494: #389 (a repository setting); #430, #432, #440 items 1–2 and #461 item 1 (each needs a decision first); #447, #472–#474 and #478–#485 (WP34 features); #358 (macOS CI) and #475 (benchmark toolchains); #382 and #357 (nearly done; a human should close them after checking). The tracking issues #395, #412, #413, #419, #451, #456, #494 and #516 are run ledgers, not work. **#446 is already done**: #502 merged and did exactly what it asked. The lead closes it with a comment pointing at #502 when the ledger opens.

## Approach

- **Two lanes, max 4 sessions.** Lane A holds every `src/` stage, strictly in sequence. Each starts from `main` after the previous one merged, because every `src/` change moves `tests/self/goldens/checked*.txt`. Lane B holds stages that touch no `src/` file. They run beside lane A and beside each other, up to the session cap.
  - lane A: hoist-new-resize → nonexported-method → owner-checks → fix-followups-461 → fix-followups-440 → join-same-pass
  - lane B: index-of-any-offset, x509-random, tls-res-master, k1-remainder, ct13 (in parallel)
  - last: security-readme, after every stage that edits a record
- **`docs/security/README.md` belongs to `security-readme` alone.** The other stages update their own record (`codegen.md`, `cli.md`, `crypto-x509.md`, `tls.md`, `crypto-k1.md`, `ct-verification.md`). They leave the counts to the last stage, which keeps the lanes from conflicting on one table.
- **`tests/run.js` is shared**, and each stage edits only its own block. Merge order: index-of-any-offset → x509-random → k1-remainder → fix-followups-440. Whoever merges later merges `main` in first.
- **Every stage obeys CLAUDE.md.** That covers the rolling freeze (`src/` uses no construct the seed in `build/seed` lacks), goldens regenerated with `node tests/self/goldens.js --update` and never hand-edited, the exact LLVM IR in the PR body for every TypeScript snippet added to the tests, a negative test per fix, and a conventional commit whose subject and body are the changelog entry. Secret material in `std/crypto` is a `Secret` and gets wiped.
- **Closing.** A PR says `Fixes #N` only when it closes the whole issue. Otherwise it says `Refs #N` and lists what is left.
- **A stage that turns out to be impossible as written** goes up as a draft PR that says what blocked it. It never substitutes other work.

## hoist-new-resize

**Owns:** `src/emit-arrays.ts`, `src/attributes.ts`, `tests/cases/**` (new case + moved goldens), `tests/nish-cmp.js`, `tests/self/goldens/**`, `docs/security/codegen.md`, `docs/IR_COOKBOOK.md`

Add the #435 program as a failing-first golden (Node prints 706). In `callMayResize` (`src/emit-arrays.ts:544`), treat a class `new` like a call to `@C.constructor`, using its fixpoint `resizesArray` fact. Fold `rightSideMayResize` (CG-10) into it if that comes out cleanly. Only the IR of loops whose constructor really resizes may move. List every golden that moves in the PR body, with the reason. Add a `codegen.md` row (the next CG number).

## nonexported-method

**Owns:** `src/checker.ts`, `src/members.ts`, `src/visibility.ts`, `src/emit-classes.ts`, `src/symbols.ts`, `src/codes.ts`, `docs/LANGUAGE.md`, `tests/link/**` (new case only), `tests/cases/**` (new case only), `tests/self/goldens/**`

Reproduce it with a minimal std-like package: an exported function returns a value of a non-exported class, and another package calls a method on that value. Then pick the sound fix. Linking it (emitting the method with linkage the caller can reach) is preferred if a non-exported class's value reaching another package is already legal. Refusing with a coded diagnostic (via `scripts/gen-diagnostic-codes.mjs`) is preferred if the language rule says that value should not be reachable. Either way, name the rule in `LANGUAGE.md`.

## owner-checks

**Owns:** `src/compile.ts`, `src/run-cache.ts`, `src/compilation.ts`, `src/codes.ts`, `tests/nish/cli.ts`, `tests/self/goldens/**`, `docs/security/cli.md`, `docs/LANGUAGE.md`

First check that `build/seed/bin/nish` compiles a program calling `lstatOwnerModeSync`, `geteuid` and `isExecutableSync`. If it does not, stop with a draft PR, because the rolling freeze forbids the change. Then make three changes:

- `runProgram` refuses a cache root that is not owned by `geteuid()`, or is group- or world-writable, with a coded diagnostic.
- `packageRootCandidates` checks the owner the same way.
- `programOnPath` takes the first *executable* `nish`.

Mark CLI-7 and CLI-9 fixed in `cli.md`.

## fix-followups-461

**Owns:** `src/bounds.ts`, `src/ranges.ts`, `src/diagnostics.ts`, `src/fix.ts`, `src/unsafe-migrate.ts`, `src/panics.ts`, `src/codes.ts`, `tests/cases/**`, `tests/fix/**`, `tests/link/unsafe-migrate-*/**`, `tests/nish-cmp.js`, `tests/self/goldens/**`, `docs/LANGUAGE.md`, `docs/AI.md`

- **Item 2:** reword NL9007's "an unsigned index needs only the upper one", or credit that guard and give it a fix. Pick whichever is sound and say which in the PR.
- **Item 3:** `bounds.ts` treats `uncheckedGet`/`uncheckedSet` as array reads and writes, not opaque calls. Pin it with the `a[at[0]] + b[at[1]]` shape, migrated in one `--fix` round.
- **Item 4:** add `sink.reportDeprecationFix`, make `acceptedEdits` treat an identical edit as applied, and make the flag build record the facts it would have proven.
- **Item 1** (unsafe-wrap) stays out.

## fix-followups-440

**Owns:** `src/fix.ts`, `src/checker.ts`, `src/expressions.ts`, `src/statements.ts`, `src/diagnostics.ts`, `tests/fix/**`, `tests/run.js` (the tests/fix runner only), `tests/self/goldens/**`, `docs/AI.md`, `docs/LANGUAGE.md`

- **Item 3:** fix `!xs.length` → `xs.length === 0` (NL2263), and a non-boolean `&&`/`||` operand `s.length && …` → `s.length !== 0 && …` (NL2099). Fix only where the rewrite keeps the meaning. Everywhere else there is no fix, pinned by a nofix case.
- **Item 4:** each `*.nofix.ts` gets an expected-code sidecar, and the runner checks that the diagnostic the case was written for is the one that fired.
- **Items 1 and 2** stay out.

## join-same-pass

**Owns:** `src/attributes.ts`, `src/escape.ts`, `src/emit.ts`, `tests/cases/**` (new `mem_join_parts_*` cases + moved goldens), `tests/self/goldens/**`, `docs/IR_COOKBOOK.md`, `docs/LANGUAGE.md`

Follow #503's "done when" exactly:

- A failing-first golden beside `tests/cases/mem_join_parts_scope` builds the argument inside the loop and shows `Arena.used()` flat over 1,000 passes.
- The #500 negative cases (`mem_join_parts_readback`, `_forof`, `_passed`, `_alias`, `_method`) keep the release off.
- The PR body reports breadth across `std/` and `src/` (which callees and loops change), the self-hosted compiler building `src/`, and `node bench/run.mjs --check` unchanged.

Soundness comes before reach. If the only sound rule is narrower than #503 hopes, ship the narrower rule and say what is left (`Refs #503`).

## index-of-any-offset

**Owns:** `tests/link/std_text_index_of_any/**`, `tests/link/std_text_index_of_any_non_ascii*/**` (new), `tests/run.js` (the `std_text_index_of_any` block only)

Take the first option #524 offers. The native and `--profile wasi` builds both count bytes, so check that they agree on the non-ASCII edge's *byte offsets*. Do it with a line or a sibling program that runs natively and under `--profile wasi` but stays out of the Node comparison, since Node counts UTF-16 units. Pin the expected offsets, so a wrong offset fails the native run on its own. Keep the existing Node-compared line. The PR says `Fixes #524` and states the decision it took.

## x509-random

**Owns:** `std/crypto/x509-random.ts` (new), `std/crypto/x509.ts` (comment only), `std/README.md`, `tests/link/crypto_x509_random*/**` (new), `tests/run.js` (its own registration only), `docs/security/crypto-x509.md`

Write a native-only module (exported as `nish/crypto/x509-random` by the existing `"./*"` export). It draws a P-256 private key as a `Secret<u8[]>`, rejection-sampled into range, and a positive 20-byte serial from `crypto.getRandomValues`, then calls `x509MintSelfSigned`, wiping every intermediate. `x509.ts` itself must not import it, so wasm32 programs that use x509 still compile. Tests: the minted certificate parses and verifies, two mints differ, and a wasm32 build importing the helper is refused. Mark X509-6 fixed.

## tls-res-master

**Owns:** `std/net/tls.ts`, `tests/link/net_tls_rfc8448/**`, `tests/link/net_tls_rfc8448_f64/**`, `docs/security/tls.md`

Once the client Finished is accepted, compute `tlsDeriveSecret(h, master, "res master", transcriptHash(ClientHello..client Finished))`. Expose it to the test the way the other secrets are exposed, and pin RFC 8448 §3's value (`7df235f2…`) in both twins. Under CLAUDE.md's Security rule, wipe it when the connection is done, or record it under TLS-1 for as long as it is held. NewSessionTicket, PSK and 0-RTT stay out.

## k1-remainder

**Owns:** `std/crypto/hmac.ts`, `std/crypto/hkdf.ts`, `tests/link/crypto_wycheproof*/**`, `tests/link/crypto_hmac*/**`, `tests/link/crypto_hkdf*/**`, `tests/run.js` (the -O2 wipe pin and its own registrations only), `THIRD_PARTY_NOTICES.md`, `docs/security/crypto-k1.md`

- **Item 1:** add Wycheproof's HMAC-SHA256/384/512 and HKDF-SHA256/384 vectors, carried the way `crypto_wycheproof` carries K2/K3/K5, with their notice in `THIRD_PARTY_NOTICES.md` (`.claude/licensing.md`).
- **Item 2:** HMAC and HKDF wipe their inner and outer pads and the PRK before returning. They accept a `Secret<u8[]>` key through an additional entry point where the caller holds one. Do not break the existing plain-array callers in `std/net`; moving those belongs to #430. Pin the wipe under `-O2`, the way `secret_wipe_o2` does.

## ct13

**Owns:** `tests/ct-timing.js`, `tests/ct-timing/**`, `tests/cases/ct_asm_x25519*`, `docs/security/ct-verification.md`, `std/crypto/x25519.ts` (only if a real leak is found)

Feed `ladderStep` reduced 25.5-bit limbs and a 0/1 `swap`, in the full seven-function driver and linked alone, at 300,000 samples, several runs each. Record the |t| readings and the CPU.

- If the gap disappears, constrain the harness to the domain and record why.
- If it persists, locate the instruction responsible (perf, llvm-mca or the disassembly). Then fix `x25519.ts`, or record precisely what was found and keep CT-13 open (`Refs #378`).

## security-readme

**Owns:** `docs/security/README.md`
**Model:** sonnet

Depends on hoist-new-resize, owner-checks, x509-random, tls-res-master, k1-remainder and ct13 having merged or been escalated. Recount every record under `docs/security/` by severity and state, rewrite each Areas row, then sum the Total row from those rows. Prune "Open findings" and the footnotes to match. Documentation only.

## Acceptance criteria

1. The #435 program prints `706` from a native build, as under Node (#435).
2. The #442 shape either links and prints its result, or is refused at check time by a coded diagnostic that names the class. It never fails at link (#442).
3. `nish run` refuses a cache root that is world-writable or owned by another user, with a coded diagnostic. A non-executable `nish` earlier on `PATH` is skipped. `cli.md` marks CLI-7 and CLI-9 fixed (#486).
4. NL9007's message offers no guard spelling that fails to compile or to be credited. Migrating `a[at[0]] + b[at[1]]` reaches its fixed point in one `--fix` round (#461 items 2–4).
5. `nish --fix` rewrites `!xs.length` and `s.length && …` to explicit comparisons. A nofix case whose expected code differs from the code that fired fails `npm test` (#440 items 3–4).
6. A loop that reads a string in each pass and hands it to a parts + join callee shows a flat `Arena.used()` over 1,000 passes, and the #500 negative cases still keep the release off (#503).
7. Changing the byte offset `indexOfAny` returns on the non-ASCII edge makes the native or wasi run fail `npm test` (#524).
8. A native program using the new x509-random helper mints two distinct certificates that each parse and verify, and a wasm32 build importing it is refused. X509-6 is marked fixed (#385).
9. `net_tls_rfc8448` checks `resumption_master_secret` against RFC 8448 §3's value, byte for byte (#445).
10. Wycheproof HMAC-SHA256/384/512 and HKDF-SHA256/384 run in `npm test` with every vector agreeing, and a test pins that HMAC's and HKDF's wipe survives `-O2` (#476).
11. CT-13 in `docs/security/ct-verification.md` states in-domain readings and a decision (#378).
12. Every Areas row of `docs/security/README.md` matches a recount of its record, and the Total row is their sum.
13. On `main` after the last merge, `npm run check` and an undegraded `npm test` are green.

## Out of scope

The issues listed under Context. Nothing in `std/net/**` beyond `tls.ts`'s res master. No change to the Release PR flow (#531 is never touched). No coverage or threshold configuration.

## Verification

Every stage runs `npm run check`, an undegraded `npm test` (read the skip count), `npm run lint && npm run lint:dead`, `node docs/check-links.mjs`, and its own verification line. Any `src/` change also runs `node tests/self/goldens.js` (regenerate with `--update`, then read the diff), plus `node scripts/gen-diagnostic-codes.mjs --check` when it adds a code.
