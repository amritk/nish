---
name: Issue sweep 3
overview: Fix every open issue on amritk/nish that an agent in a Linux container can finish without a release, a macOS runner, a repository setting or an owner's design call — eleven PRs covering fourteen issues, with the release-gated halves of #385 and #386 landed as their builtin-first phase.
stages:
  - id: obj-lit-nullable
    title: "fix(checker): type an object literal in an `I | null` context as the struct, not the union"
    goal: "#324 and #330 — an object literal returned, bound, or used as a ternary arm where `I | null` is expected compiles and runs instead of crashing the emitter with `unknown struct`"
    verification: "npm run check && UPDATE_GOLDENS=1 node tests/run.js obj_lit_nullable && node tests/self/goldens.js --update && npm test"
    todos:
      - id: oln-fix
        content: "Return the stripped struct type from checkObjectLiteral in src/members.ts (and checkConditional in src/expressions.ts if needed) — see obj-lit-nullable"
        status: pending
      - id: oln-cases
        content: "Add positive cases tests/cases/obj_lit_nullable_{ternary,return,arrow,local}.ts with .ll and .stdout, plus one reject_obj_lit_nullable_* negative — see obj-lit-nullable"
        status: pending
      - id: oln-docs
        content: "Add the rule to docs/LANGUAGE.md's object-literal section and regenerate checked goldens — see obj-lit-nullable"
        status: pending
  - id: slice-literal-port
    title: "fix(checker): prove a literal receiver's slice in range so NL8002 stays quiet"
    goal: "#326 — `\"abcdef\".slice(1, 3)` and a const bound to a string literal no longer raise the NL8002 portability warning"
    verification: "npm run check && node tests/run.js port_str && node tests/self/goldens.js --update && npm test"
    todos:
      - id: slp-fix
        content: "Teach proveSliceBounds / judgeClampBound in src/bounds.ts the length of a literal or literal-bound const receiver, scoped to the sliceClamps path — see slice-literal-port"
        status: pending
      - id: slp-cases
        content: "Add quiet cases tests/cases/port_str_slice_literal*.ts with .portability, and keep a loud counterpart — see slice-literal-port"
        status: pending
  - id: wasi-realpath
    title: "fix(runtime): build the wasi profile against a libc without realpath"
    goal: "#390 — `--profile wasi` builds and runs with WASI_SYSROOT=/usr on Ubuntu's packaged wasi-libc"
    verification: "sudo apt-get install -y wasi-libc libclang-rt-18-dev-wasm32 && WASI_SYSROOT=/usr node tests/run.js wasi && npm test"
    todos:
      - id: wr-stub
        content: "Guard nish_realpath in runtime/runtime-os.c so a libc without realpath gets a NULL answer, without changing wasi-sdk behaviour — see wasi-realpath"
        status: pending
      - id: wr-docs
        content: "Note the wasi contract in runtime/nish.h and the packaged-sysroot route in docs/INSTALL.md — see wasi-realpath"
        status: pending
  - id: net-ipv6-docs
    title: "test(runtime): exercise nish:net's dual-stack IPv6 path, and correct its error-rule wording"
    goal: "#355 and #356 — npm test exercises listen on `::` over IPv4 and IPv6 where the host has IPv6 and reports (never skips) where it has not; LANGUAGE.md states the error rule and Darwin's ECN answer accurately"
    verification: "node tests/run.js net_ && node docs/check-links.mjs && npm test"
    todos:
      - id: ni-test
        content: "Add a net_ dual-stack check in tests/run.js's nish:net sections (127.0.0.1, ::1, IPV6_TCLASS ECN) that counts a pass with a printed reason when IPv6 is absent — see net-ipv6-docs"
        status: pending
      - id: ni-docs
        content: "Reword the nish:net error rule and document Darwin's meta[1]=0 / send -95 in docs/LANGUAGE.md and runtime/runtime-net.c's header comment — see net-ipv6-docs"
        status: pending
  - id: awfy-rss
    title: "test: pin the AWFY Storage and List peak-RSS results"
    goal: "#325 — npm test fails if AWFY Storage or List peak RSS regresses past the ratio #207 measured"
    verification: "node tests/run.js mem_awfy && npm test"
    todos:
      - id: ar-check
        content: "Add a mem_awfy_* check to tests/run.js beside mem_loop_scope_chunk using bench/rss.c: Storage vs a small-iteration run, List at 100000 vs List at 10, each within 1.25x — see awfy-rss"
        status: pending
  - id: ct-records
    title: "test: constant-time check plumbing (CT-14, CT-15), a narrower nish-cmp declaration, and record corrections"
    goal: "#388 and the record half of #389 — ct_asm names its real expect kind and fails rather than skips without an aarch64 target; nish-cmp's blanket declarations are narrowed against 0.16.0; every security record correction #388 lists is made and SC-16 records immutable releases as on"
    verification: "node tests/run.js ct_asm && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && node docs/check-links.mjs && npm test"
    todos:
      - id: ct-14-15
        content: "Fix CT-14 check names and CT-15 fail-not-skip in tests/run.js's ct_asm section — see ct-records"
        status: pending
      - id: ct-nishcmp
        content: "Run nish-cmp against 0.16.0 and prune or narrow the stale DECLARED entries in tests/nish-cmp.js — see ct-records"
        status: pending
      - id: ct-records-docs
        content: "Correct docs/security/{ct-verification,crypto-k1,codegen,cli,supply-chain,README}.md per #388's list and SC-16 — see ct-records"
        status: pending
  - id: typed-push-pop
    title: "fix(checker): refuse push and pop on typed arrays reached through Map/Set reads, generics and imported aliases"
    goal: "#347 — each of the three residual shapes is refused with NL2415"
    verification: "npm run check && node tests/run.js reject_typed && node tests/self/goldens.js --update && npm test"
    todos:
      - id: tpp-checker
        content: "Carry the typed-array spelling through Map/Set reads, generic instantiation and cross-module aliases in src/symbols.ts, src/generics.ts, src/declarations.ts, src/members.ts — see typed-push-pop"
        status: pending
      - id: tpp-cases
        content: "Add one reject_typed_push_* negative per shape and update the LANGUAGE.md rule and docs/wp33-round-trip.md §3.3 — see typed-push-pop"
        status: pending
  - id: runtime-hardening
    title: "fix(runtime): remaining runtime hardening (RT-10..RT-13) and shim O_NOFOLLOW parity"
    goal: "#387 — signalFd uses compare-and-swap, writes loop on short counts, descriptors are O_CLOEXEC, EINTR is retried, the Node shim refuses symlinks where the native runtime does, CG-8 comments land"
    verification: "npm run check && npm test && npm run test:node"
    todos:
      - id: rh-c
        content: "Fix RT-10..RT-13 in runtime/runtime-host.c, runtime/runtime.c, runtime/runtime-os.c with tests in tests/runtime-test.c — see runtime-hardening"
        status: pending
      - id: rh-shim
        content: "Add O_NOFOLLOW to writeFileSync, appendFileSync and spawnImpl in runtime/shim.mjs, and the CG-8 willreturn comments in src/runtime.ts — see runtime-hardening"
        status: pending
      - id: rh-record
        content: "Update docs/security/runtime.md's RT-10..RT-13 rows — see runtime-hardening"
        status: pending
  - id: wipe-primitive
    title: "feat(runtime): a secure-wipe builtin the optimiser cannot drop"
    goal: "#385 phase 1 — std code can call a wipe builtin whose stores survive -O2 and LTO, pinned by a test; std/crypto adoption stays for the release after it"
    verification: "npm run check && UPDATE_GOLDENS=1 node tests/run.js wipe && npm test"
    todos:
      - id: wp-runtime
        content: "Add a non-inlinable nish_wipe in runtime/runtime.c and runtime/nish.h, its builtin in src/builtins.ts and src/runtime.ts, and its shim and nish.d.ts entries — see wipe-primitive"
        status: pending
      - id: wp-tests
        content: "Add tests/cases/wipe_* (golden .ll, llvm-as, round trip, negative) and a test proving the wipe survives -O2 with LTO — see wipe-primitive"
        status: pending
      - id: wp-docs
        content: "Add the LANGUAGE.md rule and cookbook entry, and record the primitive in docs/security/crypto-{ecc,x509}.md with adoption pending the next release — see wipe-primitive"
        status: pending
  - id: owner-builtins
    title: "feat(cli): builtins for the owner checks, and a cryptographic run-cache name (CLI-8)"
    goal: "#386 phase 1 — the RT-9 primitives (lstat owner/mode, euid, is-executable) are reachable as builtins, the run cache is named by SHA-256 instead of FNV-1a, and bootstrap.sh stops taking the checkout's parent as the package root; CLI-7 and CLI-9 adoption stays for the release after it"
    verification: "npm run check && npm test && npm run build && npm run test:cli"
    todos:
      - id: ob-builtins
        content: "Expose nish_lstat_owner_mode, nish_euid and nish_is_executable as builtins through src/builtins.ts, src/runtime.ts, runtime/shim.mjs, runtime/nish.d.ts — see owner-builtins"
        status: pending
      - id: ob-cli8
        content: "Replace fnv1a64Hex in src/run-cache.ts with a SHA-256 written in plain Nish, and fix scripts/bootstrap.sh's package root — see owner-builtins"
        status: pending
      - id: ob-tests-docs
        content: "Add the new-construct tests, LANGUAGE.md rule and docs/security/cli.md rows — see owner-builtins"
        status: pending
  - id: codegen-cg
    title: "fix(codegen): close CG-2, CG-4, CG-8 and CG-10"
    goal: "#382 minus CG-3 — negative `new Array(n)` no longer wraps the inline allocator, willreturn is not inferred through recursion, and the CG-8 and CG-10 emitter fixes land, each with a failing-first test and regenerated goldens"
    verification: "npm run check && node tests/self/goldens.js --update && bash docs/cookbook/regen.sh --check && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js && npm test"
    todos:
      - id: cg-fixes
        content: "Fix CG-2 in src/runtime.ts inlineAllocator / src/emit-arrays.ts, CG-4 in src/attributes.ts propagate, CG-8 and CG-10 in the emitter — see codegen-cg"
        status: pending
      - id: cg-goldens
        content: "Regenerate tests/cases/*.ll, cookbook and checked goldens; add the nish-cmp declaration whose words match the subject; update docs/security/codegen.md — see codegen-cg"
        status: pending
---

# Issue sweep 3

Requirements, as given: *"go through the issues and fix what we can"*.

Base: `main` @ `f120de1` (0.16.0 is the seed). Seventeen issues are open; this plan takes fourteen of them in whole or in part.

## What is left out, and why

| issue | why not in this run |
|---|---|
| #357 nish:net umbrella | It asks for a series of features. It needs splitting into issues before anyone builds it, and `tcpConnect` alone is a new construct worth its own run. |
| #358 Darwin CI | There is no macOS here, so every Darwin failure would be debugged blind through CI pushes. |
| #378 CT-13 | It asks for a verdict, leak or artefact, on a noisy shared VM. That is the owner's call, made with evidence from a second machine. |
| #382 CG-3 | It is a design choice: panic or saturate `.length`, or make the prover distrust i32 lengths. The choice moves the perf gate. CG-2, CG-4, CG-8 and CG-10 are in `codegen-cg`. |
| #385 adoption, X509-6 | `std/crypto` may only use the wipe builtin after a release ships it. X509-6's native-only module is a design call. |
| #386 CLI-7, CLI-9 | `src/` may only use the owner builtins after a release ships them (the rolling freeze). |
| #389 the setting | v0.16.0 already reports `immutable: true`. Only the record update is left, and it is in `ct-records`. Attestations need `id-token` permissions on `release.yml`, which is the owner's call. |

## Shared files: the rules every worker follows

- **Regenerated goldens** (`tests/self/goldens/checked*.txt`, `tests/cases/*.ll`, `docs/cookbook/**`) belong to whichever stage regenerates them. They are never hand-merged. On a conflict, merge `main` in and regenerate.
- **Section-owned files.** Each stage below names its sections of these files and edits nothing else in them:
  - `docs/LANGUAGE.md`
  - `tests/run.js`
  - `docs/security/*.md`
- **No hand-written CHANGELOG.md.** The commit subject and body are the changelog entry.

## obj-lit-nullable

**Owns:**
- `src/members.ts`, `src/expressions.ts`
- `tests/cases/obj_lit_nullable_*`, `tests/cases/reject_obj_lit_nullable_*`
- `docs/LANGUAGE.md` § object literals
- regenerated goldens

The checker validates the literal against `stripNull(want)` but returns `want` (`src/members.ts` ~540/545), so the emitter looks up a struct for the union. The fix returns the struct type, after checking that assignment into `E | null` stays representation-compatible.

Cover all four forms:
- the ternary arm (#324);
- `return`, an arrow body, and a declared nullable local (#330).

Each form gets a golden `.ll` and a `.stdout`. The PR body shows the exact IR.

## slice-literal-port

**Owns:**
- `src/bounds.ts`
- `tests/cases/port_str_slice_literal*`
- regenerated goldens

Keep the fold on the `sliceClamps` path. If the shared proof learns literal lengths, `nodeProvenClamp` will also drop `substring` clamps. That moves IR goldens and needs a nish-cmp declaration, so avoid it unless it is deliberate and declared.

## wasi-realpath

**Owns:** `runtime/runtime-os.c` (the `nish_realpath` function only), `runtime/nish.h`, `docs/INSTALL.md`.

`src/compilation.ts:354` already falls back on a NULL `realpathSync`. Prefer feature-detecting the missing declaration over a blanket `__wasi__` stub, so wasi-sdk keeps its real `realpath`.

## net-ipv6-docs

**Owns:** `tests/run.js` § nish:net sections, `tests/cases/net_*`, `runtime/runtime-net.c` (comments only), `docs/LANGUAGE.md` § `nish:net`.

When the host has no IPv6, the check prints why and counts as a pass. It must not add to the skip count. CI's ubuntu-latest exercises the real path.

## awfy-rss

**Owns:** `tests/run.js` § memory/RSS checks, new files under `bench/` (no edits to existing bench programs).

Use ratios measured on one machine, never absolute bytes.

## ct-records

**Owns:**
- `tests/run.js` § `ct_asm`
- `tests/ct-asm.js`, `tests/nish-cmp.js`
- `docs/security/{ct-verification,crypto-k1,codegen,cli,supply-chain,README}.md`

The record corrections #388 lists, in its body and its comment:
- the K1-6 disposition;
- the "held by discipline only" list;
- links from CG-3 and K1-6 to #382, and from CT-13 to #378;
- CLI-6 marked Fixed.

Also mark SC-16 as on, citing v0.16.0's `immutable: true`, and leave attestations open. `codegen-cg` and `owner-builtins` depend on this stage for `codegen.md` and `cli.md`.

## typed-push-pop

**Owns:**
- `src/symbols.ts`, `src/generics.ts`, `src/declarations.ts`, `src/members.ts`
- `tests/cases/reject_typed_push_*`
- `docs/LANGUAGE.md` § typed-array names, `docs/wp33-round-trip.md`
- regenerated goldens

**Depends on:** `obj-lit-nullable`, for `src/members.ts`. This stage starts after that one merges.

The change is compile-time only, so no `.ll` golden may move.

## runtime-hardening

**Owns:**
- `runtime/runtime-host.c`, `runtime/runtime.c`, `runtime/runtime-os.c`
- `runtime/shim.mjs`, `runtime/nish.d.ts`
- `src/runtime.ts` (comments only)
- `tests/runtime-test.c`, `docs/security/runtime.md`

**Depends on:** `wasi-realpath`, for `runtime-os.c`.

## wipe-primitive

**Owns:**
- `runtime/runtime.c`, `runtime/nish.h`
- `src/builtins.ts`, `src/runtime.ts`
- `runtime/shim.mjs`, `runtime/nish.d.ts`
- `tests/runtime-test.c`, `tests/cases/wipe_*`
- `docs/LANGUAGE.md` § new wipe rule, `docs/IR_COOKBOOK.md`, `docs/security/crypto-{ecc,x509}.md`
- regenerated goldens

**Depends on:** `runtime-hardening`.

Links use `-flto`, so the test has to prove the stores survive LTO at `-O2`. This is the full new-construct checklist (`docs/ARCHITECTURE.md`).

## owner-builtins

**Owns:**
- `src/builtins.ts`, `src/runtime.ts`, `src/run-cache.ts`, `src/compile.ts`
- `runtime/shim.mjs`, `runtime/nish.d.ts`
- `scripts/bootstrap.sh`, `tests/nish/cli.ts`, `tests/cases/owner_*`
- `docs/LANGUAGE.md` § new rule, `docs/security/cli.md`
- regenerated goldens

**Depends on:** `wipe-primitive` and `ct-records`.

`src/` must not call the new builtins: the rolling freeze, which CI's bootstrap job enforces. CLI-8's SHA-256 is plain Nish in `src/`, not an import from `std/`.

## codegen-cg

**Owns:**
- `src/attributes.ts`, `src/emit-arrays.ts`, `src/runtime.ts`, the emitter files the CG-8 and CG-10 fixes need
- `tests/cases/**` (regenerated), `docs/cookbook/**`, `docs/IR_COOKBOOK.md`
- `tests/nish-cmp.js`, `tests/perf-baseline.json`, `docs/security/codegen.md`

**Depends on:** every other stage that touches `src/` or moves goldens. It goes last.

Each finding gets a test that fails on the base. Commit trailers carry `Measured:` figures for any perf move.
