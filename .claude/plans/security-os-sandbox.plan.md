---
name: WP37 — the OS sandbox (--sandbox), built
overview: Build docs/wp37-os-sandbox.md. `--sandbox` (strict) and `--sandbox=best-effort` make the native main wrapper confine the process, from a `.preinit_array` entry, with no_new_privs, a capability drop, a Landlock ruleset and a seccomp filter derived from main's computed `FunctionFacts.caps`. A second stage accepts the `fs.read=<dir>` / `fs.write=<dir>` scopes the compiler refuses today, but only under --sandbox, as Landlock path_beneath rules. Every open question of the note (§11) is resolved by its recommendation. Fixes #451.
stages:
  - id: sandbox-core
    title: "feat(cli): --sandbox confines a native program to main's capability set"
    goal: "`nish --link`/`nish run`/IR-only builds accept --sandbox and --sandbox=best-effort; the emitted wrapper calls nish_sandbox from .preinit_array and nish_sandbox_check first in @main; the new runtime unit applies no_new_privs, the capability drop, Landlock masked to the running ABI and the seccomp filter of §4; darwin, N-API and the no-main routes are refused as §2 says; wasm emits no call; no golden moves without the flag; directory scopes stay refused word for word"
    verification: "npm run check && npm run lint && node tests/run.js sandbox && node tests/run.js runtime-budget && node tests/run.js self && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && npm test"
    status: pending
    todos:
      - id: core-flags
        content: "Parse --sandbox / --sandbox=best-effort in src/compile.ts (any other value exit 2 naming both); the accept/refuse table of §2 (refuse --fix, --emit-ast, --emit-checked, IR-only with no main, the N-API profile); the flag joins nish run's cache key (src/run-cache.ts); list it in --help (src/cli-style.ts)"
        status: pending
      - id: core-darwin-code
        content: "Refuse a darwin target (explicit or host) with the next free NL3xxx in src/codes.ts (NL3041 at 804120e — re-check it is still free when committing; never reuse a number), with its wording in tests/wordings/ and its row in AGENTS.md's table if that table lists the band"
        status: pending
      - id: core-emit
        content: "Emit §3's IR exactly: @.sandbox.preinit in .preinit_array, @llvm.used, internal @.sandbox.apply calling nish_sandbox(i32 caps, i32 mode, i8* null, i8* null), nish_sandbox_check() first in @main, the two declares; nothing emitted without the flag; nothing on wasm targets; src/runtime.ts declares the two functions"
        status: pending
      - id: core-runtime
        content: "New runtime/runtime-sandbox.c per §3/§4/§6: nish_cpu_prime first (split out of nish_cpu_count in runtime-parallel.c, no getenv at preinit), PR_SET_NO_NEW_PRIVS, drop every capability and read each set back, Landlock ruleset masked to the probed ABI (IOCTL_DEV granted back only with process.spawn; process.spawn grants EXECUTE+READ_FILE beneath /), seccomp BPF with the arch check, x32 bit-30 kill, always-on ptrace/process_vm_*/pidfd_getfd kills, io_uring/net/process.spawn kills, clone3 ENOSYS, clone without CLONE_THREAD killed, metadata writes EPERM without fs.write, TSYNC + KILL_PROCESS; strict failure prints `nish: --sandbox: <what> (<errno>)` exit 126; best-effort warns once; seccomp failure fatal in both modes; nish_sandbox_check exit 126 when preinit never ran (musl); non-Linux stub; NISH_SANDBOX_SIMULATE_ABI test-only define, absent from build.sh's flags. Prototypes in runtime/nish.h"
        status: pending
      - id: core-wire-unit
        content: "Pair runtime-sandbox.c in scripts/build.sh's halves and src/run-cache.ts runtimeUnits(); the wasm profile in build.sh greps for `@nish_sandbox(` and exits 2 with §3's message; add the RUNTIME_SANDBOX_TEXT_BUDGET row to tests/runtime-budgets.js (ceiling from the measured figure, comment beside it) and re-measure the two parallel budgets if they moved"
        status: pending
      - id: core-tests
        content: "A `sandbox` section in tests/run.js with every §8 check that needs no directory scope, as bespoke spawnSync checks, Landlock-gated checks skipping with the named reason after one probe, the simulated-ABI builds for 0/1/2; a golden .ll with an llvm-as pass for the wrapper; a negative case per refusal of §2; the CLI errors in tests/nish/cli.ts; regenerate tests/self/goldens with node tests/self/goldens.js --update and register any new positive tests/cases/* with node tests/differential/goldens.js --update"
        status: pending
      - id: core-docs
        content: "docs/LANGUAGE.md 'The sandbox' rule under Capabilities (after 'The capability policy'); a guide page docs/guide/using-nish/sandbox.md routed in scalar.config.json, with exit 159, 126 and the fallback messages; the CLI guide page and docs/AI.md lines for the flag; docs/IR_COOKBOOK.md entry plus the regenerated prelude (docs/cookbook/regen.sh); docs/security/sandbox.md (threat model first, then the mapping check, the limits: IFUNC, IOCTL_DEV below ABI 5, CI kernel unverified) linked from docs/security/README.md; SECURITY.md's threat model names the sandbox and what it does not cover; the note's Status line says stage 1 is built"
        status: pending
  - id: sandbox-scopes
    title: "feat(cli): fs.read=<dir> and fs.write=<dir> scopes under --sandbox"
    goal: "With --sandbox on the same command line, --allow fs.read=<dir> and fs.write=<dir> are accepted (resolved to an absolute symlink-free existing path at compile time) and enforced as Landlock path_beneath rules; without --sandbox the existing refusal stays word for word; an ffi mask widens per OQ13"
    verification: "npm run check && npm run lint && node tests/run.js sandbox && node tests/run.js self && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && npm test"
    status: pending
    todos:
      - id: scopes-parse
        content: "Move the scope check after argv parsing in src/compile.ts (minimal edit: keep each scope as written and decide once the command line is read, so flag order does not matter); realpath + exists at compile time; refusal text unchanged without --sandbox"
        status: pending
      - id: scopes-emit
        content: "Emit @.sandbox.read / @.sandbox.write NUL-separated double-NUL-terminated constants and pass them as nish_sandbox's third and fourth operands (null when the capability is granted whole); OQ13: for an ffi mask, the policy's net/fs.*/process.spawn grants widen the set"
        status: pending
      - id: scopes-runtime
        content: "In runtime/runtime-sandbox.c add path_beneath rules for the scoped dirs, the ABI-3 floor for a scoped fs.write, metadata writes still EPERM inside the dir, and the missing-scope-directory fallback (strict exit 126 naming it; best-effort names it once)"
        status: pending
      - id: scopes-tests
        content: "The scoped §8 checks in tests/run.js (fs.read=<dir> reads inside and not outside; a missing scope directory refuses strict; spawn redirect without fs.write); CLI errors in tests/nish/cli.ts; a CI step in .github/workflows/ci.yml that prints uname -r and the Landlock probe, and greps '^PASS  sandbox: fs.read=<dir> reads inside and not outside' from the shard's test.log (not required until §5's CI kernel row is measured); goldens regenerated"
        status: pending
      - id: scopes-docs
        content: "LANGUAGE.md, the guide page, docs/AI.md, docs/security/sandbox.md and the note's Status line updated for the scopes"
        status: pending
---

# WP37 — the OS sandbox, built

Design: `docs/wp37-os-sandbox.md` (merged in #755). Base main @ 804120e.
Fixes #451. Prior run #752 wrote the note only.

## Open questions, resolved by the note's recommendations

OQ1 (a) `fs.write=<dir>` on the command line, no manifest scopes; metadata
writes stay EPERM inside the dir · OQ2 (a) exit 126 · OQ3 (a) keep
best-effort · OQ4 (a) denylist · OQ5 (a) EXECUTE+READ_FILE beneath `/` with
process.spawn · OQ6 (a) prime the pool ceiling before confinement · OQ7 (a)
seccomp kills `socket` · OQ8 (a) ABI 6 scoping · OQ9 (a) new
`runtime/runtime-sandbox.c` · OQ10 (c) out of scope · OQ11 (a) state IFUNC as
a limit · OQ12 (a) state IOCTL_DEV below ABI 5 · OQ13 (a) an `ffi` mask is
widened by the policy's net/fs.*/process.spawn grants.

## sandbox-core

**Owns:** `src/compile.ts` `src/emit*.ts` `src/runtime.ts` `src/codes.ts`
`src/run-cache.ts` `src/cli-style.ts` `src/options.ts` `src/compilation.ts`
`runtime/runtime-sandbox.c` `runtime/runtime-parallel.c` `runtime/nish.h`
`scripts/build.sh` `tests/run.js` `tests/runtime-budgets.js`
`tests/cases/sandbox_*` `tests/wordings/**` `tests/nish/cli.ts`
`tests/link/sandbox_*/**` `tests/self/goldens/**` `tests/differential/**`
`docs/LANGUAGE.md` `docs/AI.md` `docs/guide/**` `scalar.config.json`
`docs/IR_COOKBOOK.md` `docs/cookbook/**` `docs/security/sandbox.md`
`docs/security/README.md` `SECURITY.md` `docs/wp37-os-sandbox.md` `AGENTS.md`

Sibling security runs work on main at the same time: `security-dep-capabilities`
edits `src/capabilities.ts`, `src/compile.ts` and LANGUAGE.md's Capabilities
section; `security-open-findings` edits `src/compile.ts`;
`security-binary-hardening` edits `scripts/build.sh` flags and CI. Keep edits in
those files minimal and local; on a conflict, merge main (`npm run sync-main`)
rather than resolve by rewriting their work. The rolling freeze applies: `src/`
must not *use* a construct or builtin the seed (0.20.0) lacks.

## sandbox-scopes

Depends on sandbox-core (it extends its flag, emission and runtime unit), so it
is spawned after sandbox-core merges.

**Owns:** `src/compile.ts` `src/emit*.ts` `src/capabilities.ts` (only if the
OQ13 widening lives there; minimal) `runtime/runtime-sandbox.c` `tests/run.js`
`tests/nish/cli.ts` `tests/self/goldens/**` `tests/differential/**`
`.github/workflows/ci.yml` (the one grep step) `docs/LANGUAGE.md` `docs/AI.md`
`docs/guide/**` `docs/security/sandbox.md` `docs/wp37-os-sandbox.md`

## Verification

Per stage, as its `verification` line. The full `npm test` runs twice per PR:
before opening it and after the last merge of main; read the skip count and the
`DEGRADED:` banner. Show the exact LLVM IR for every TypeScript snippet the PR
adds to the tests. Commit subject is the changelog line; trailers `Measured:`
(binary size and startup cost of the wrapper, with noise band), `Refs:`,
`Tests:`.
