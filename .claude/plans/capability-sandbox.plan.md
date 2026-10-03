---
name: Capability policy and the OS sandbox
overview: WP35's capability report has landed (#423). This run adds the two halves that act on it — WP36, a compile-time policy (`--allow`/`--deny`, and a `"nish"` field in package.json) that refuses a program reaching a capability it was not granted, and WP37, an opt-in `--sandbox` that has the native main wrapper confine the process with Landlock and seccomp to the capabilities the compiler computed, so the promise holds even when C code misbehaves.
stages:
  - id: policy
    title: "feat(checker): refuse a program that reaches a capability its policy does not grant (WP36)"
    goal: A program compiled with --allow/--deny, or whose root package.json carries a capability policy, is refused at compile time with a coded diagnostic and a witness chain whenever its computed capabilities exceed that policy
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, skip count read) && npm run build && npm run test:cli
    todos:
      - id: policy-design
        content: Write docs/wp36-capability-policy.md — semantics of allow/deny, precedence, manifest shape, codes, what is not enforced — see Stage 1 Policy semantics
        status: pending
      - id: policy-flags
        content: Parse repeatable --allow <cap>[,<cap>] and --deny <cap>[,<cap>] in src/compile.ts and src/options.ts, accepted by nish run, with exit-2 usage errors for an unknown name, a cap both allowed and denied, and any =<dir> suffix — see Stage 1 Flags
        status: pending
      - id: policy-manifest
        content: Read the root package.json "nish".capabilities { allow, deny } through src/manifest.ts, nested beside noPanic and reusing the manifestFieldAt and manifestDirAbove readers that landed with --deny-panics, with an NL3xxx diagnostic spanned inside package.json for a malformed field — see Stage 1 Manifest
        status: pending
      - id: policy-unsafe-bit
        content: Wire the reserved unsafe capability bit so every nish:unsafe call seeds it in src/capabilities.ts and src/attributes.ts, and regenerate the caps goldens it moves — see Stage 1 The unsafe bit
        status: pending
      - id: policy-refusal
        content: Add the refusal in Compilation.check() — one NL2xxx error per refused capability, spanned at main's first witness hop with the chain as notes, entry-closure only — see Stage 1 Refusal
        status: pending
      - id: policy-tests
        content: Add tests/wordings cases for every new code, tests/link fixtures for a granted program that runs and a manifest policy, and tests/nish/cli.ts checks for the flags — see Tests
        status: pending
      - id: policy-docs
        content: Add the docs/LANGUAGE.md Capabilities policy rule, a docs/AI.md line, a cookbook entry, --help and AGENTS.md flag table rows — see Stage 1 Docs
        status: pending
  - id: sandbox
    title: "feat(runtime): confine a native program to its computed capabilities with --sandbox (WP37)"
    goal: nish --link / nish run with --sandbox emit a call from the native main wrapper to nish_sandbox, which applies Landlock (file access, with --allow fs.read=<dir> scoping) and seccomp (spawn and socket syscalls) before user code runs; refused for darwin with a stable code, a no-op on wasm and WASI
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, skip count read, Landlock checks not skipped on a Landlock kernel) && npm run build && npm run test:cli
    todos:
      - id: sandbox-design
        content: Write docs/wp37-sandbox.md — the mask-to-rules mapping, path scoping, failure modes and exit statuses, platform matrix — see Stage 2 Mapping
        status: pending
      - id: sandbox-flags
        content: Add --sandbox and --sandbox=best-effort to src/compile.ts and src/options.ts, the =<dir> suffix for fs.read/fs.write in --allow (a usage error without --sandbox), the run-cache key in src/run-cache.ts, and build.sh pass-through — see Stage 2 Flags
        status: pending
      - id: sandbox-darwin
        content: Refuse --sandbox for a darwin host or --target *-apple-darwin with the next free NL3xxx code, provoked on Linux through --target — see Stage 2 Platforms
        status: pending
      - id: sandbox-wrapper
        content: Emit the call to nish_sandbox at the top of emitEntryWrapper in src/emit.ts, with main's capability mask, the mode and the scoped directories as constants, and register the symbol in src/runtime.ts and runtime/nish.h — see Stage 2 Wrapper
        status: pending
      - id: sandbox-runtime
        content: Implement nish_sandbox in runtime/runtime-os.c behind NISH_SANDBOX and __linux__ (no-new-privs, Landlock ruleset, seccomp BPF), with scripts/build.sh passing -DNISH_SANDBOX=1 — see Stage 2 Runtime
        status: pending
      - id: sandbox-budget
        content: Add a measured runtime-os.c -DNISH_SANDBOX=1 .text row with its own ceiling in tests/run.js, keep the plain row unchanged, and record the figures in docs/wp7-runtime.md — see Stage 2 Budget
        status: pending
      - id: sandbox-tests
        content: Add the sandbox tests in tests/run.js — SIGSYS death for spawn and socket from C through ffi, EACCES outside a scoped dir, a granted program running normally, --threads, strict versus best-effort without Landlock, the darwin refusal — see Tests
        status: pending
      - id: sandbox-record
        content: Add docs/security/sandbox.md (threat model, what it does not cover) and its row in docs/security/README.md — see Stage 2 Security record
        status: pending
      - id: sandbox-docs
        content: Add the docs/LANGUAGE.md sandbox rule, a docs/AI.md line, a cookbook entry for the wrapper IR, --help and AGENTS.md rows — see Stage 2 Docs
        status: pending
---

# Capability policy and the OS sandbox

## Context

WP35 merged as #423 (`b5b266e`). Every compile now computes, per function instance, an i32 capability mask over 11 bits: `clock` `entropy` `env` `exit` `ffi` `fs.read` `fs.write` `net` `process.spawn` `signal`, plus `unsafe`, which is reserved and carried by nothing ([docs/wp35-capabilities.md](../../docs/wp35-capabilities.md) §1). The mask lives on `FunctionFacts.caps` ([src/attributes.ts](../../src/attributes.ts), filled by `propagateCapabilities`). It is always computed, because `check()` calls `analyze()` unconditionally. WP35 §7 leaves enforcement — `--deny`, a `"nish"` manifest field, a refusing diagnostic — to the next work package, and nothing in the tree confines a process at run time.

`nish:unsafe` merged as #422. Its five exports are recorded per call on `CheckedProgram.unsafeCalls` and labelled `none`.

**#443 (`--deny-panics`, `"nish": { "noPanic": [...] }`) merged as `7e56e50`, which is this run's base.** It added the root-manifest reader this run reuses (`manifestFieldAt`, `manifestDirAbove` in `src/manifest.ts`), a `denyPanicSites` step at the tail of `Compilation.check()`, a `panics` key in the capability report, and codes NL2457, NL2458 and NL3031.

## Approach

- **Two stages, run one after the other.** Stage 2 consumes Stage 1's policy representation and both edit the same CLI and `Options` code, so Stage 2 is spawned when Stage 1 merges. The split is for review size, not parallelism.
- **No policy means today's behaviour.** Neither stage refuses or changes the IR of a program that uses none of the new flags or fields, so neither is a breaking change.
- **Compile time enforces capabilities; the sandbox enforces paths.** A path is an ordinary runtime string and WP35 §7 rules out argument-level precision, so `fs.read=<dir>` cannot be proved statically. A scope the compiler cannot enforce must not be accepted silently: Stage 1 refuses any `=<dir>` as a usage error, and Stage 2 accepts it only together with `--sandbox`.
- **The sandbox confines to the *computed* set, not the policy.** If the policy is narrower, Stage 1 has already refused the program. The sandbox exists for what the analysis cannot see — C code behind `ffi` and a runtime bug — so its input is `main`'s closure mask.
- **Codes are taken at PR time.** Each stage takes the next free number in its band on `main` when its PR goes up. If another PR takes the same number first, the stage's unmerged code moves to the next free number. That is not moving a released code.
- **The coverage gate is the repo's definition of done.** The repo has no line-coverage command. As in #414, it is replaced by an undegraded `npm test` (which runs `tests/diagnostic-coverage.js`: every code provoked or listed as unreachable), `npm run lint:dead`, and a negative test for every refusal.

## Stage 1 — Policy (WP36)

**Owns:** `src/**`, `tests/**`, `docs/**`, `runtime/nish.d.ts`, `AGENTS.md`, `.claude/selfhost.md`, `.claude/architecture.md`

### Policy semantics

| Policy given | A reached capability is refused when |
| --- | --- |
| none | never (today) |
| `--deny c` (repeatable, comma lists) | `c` is reached |
| `--allow c` (repeatable, comma lists) | any reached capability is not in the allow set; giving `--allow` turns the policy into an allowlist |
| both | denied, or not allowed |

- Manifest and CLI combine. The deny sets union, and the allow sets intersect when both are present, so the CLI can only narrow a package's policy, never widen it.
- **Only the entry's closure is judged:** `main`'s mask, or the union of the entry's exports for a library. Per-dependency policy is out of scope.
- `exit` and `signal` are capabilities like the others. Under an allowlist, a program calling `process.exit` needs `--allow exit`. Ambient operations (stdout, argv, panic) are never refused.

### Flags

- `--allow <list>` and `--deny <list>` take the next argv entry. There is no `=` form here, which matches every existing value flag.
- Names are exactly WP35's. An unknown name, `unsafe` given to `--allow`, a capability that is both allowed and denied, or a `=<dir>` suffix is an uncoded exit-2 usage error, as every usage error is today.
- `nish run` accepts both. `--fix` and `--emit-ast` refuse them, as with `--capabilities`.
- Both go in `usageText()` and in the two advertised-flag lists (`tests/run.js` `documented`, `tests/nish/cli.ts` `advertisedFlags`).

### Manifest

`"nish": { "capabilities": { "allow": [...], "deny": [...] } }` in the nearest package.json above the entry, the root package only.
- Reuse `manifestFieldAt` and `manifestDirAbove` from #443, and nest the field beside `noPanic` in the same `"nish"` object.
- A malformed field (not an object, an unknown name, a non-string) is an NL3xxx error spanned inside package.json.

### The unsafe bit

- Add `CAP_UNSAFE`. A call to a `nish:unsafe` export seeds it, and it propagates like any other bit.
- `--deny unsafe` then refuses a program that reaches `uncheckedGet` and the rest anywhere in its closure.
- Allowing `unsafe` is the visible opt-in. `--allow unsafe` is refused as a usage error in this stage; the import is the opt-in, so the bit is for denying.
- The `caps` JSON gains `unsafe` for programs that use the module. Regenerate those goldens and read the diff.
- `deterministic` is unchanged: `unsafe` is not one of its eight.

### Refusal

- The refusal goes in `Compilation.check()`, after `analyze()` and next to `denyPanicSites`, so it flows through the diagnostic sink and `--json`.
- One NL2xxx error per refused capability, in index order: "`main` reaches `<cap>`, which the capability policy (`--deny <cap>` | the allowlist | package.json) does not grant".
- The span is the first witness hop (`capSite[c]` on `main`'s facts). The remaining hops are notes, each `path:line:col calls <callee>`, exactly as `--emit-capabilities` renders them.
- A library entry spans at the first export that reaches the capability.

### Docs

- `docs/wp36-capability-policy.md`.
- `docs/LANGUAGE.md` → `### Capabilities`: a policy subsection with the rule and the test that pins it.
- `docs/AI.md`: one line, "a package that must not touch the network says so in package.json".
- A cookbook entry: the refused program and its diagnostic, since no IR changes.
- An `AGENTS.md` flag-table row.
- `docs/MASTER_PLAN.md` "Next": WP35 marked done, WP36 and WP37 entered.

## Stage 2 — Sandbox (WP37)

**Owns:** `src/**`, `runtime/**`, `scripts/build.sh`, `tests/**`, `docs/**`, `AGENTS.md`, `.claude/architecture.md`, `.claude/selfhost.md`

### Flags

- `--sandbox` (strict) and `--sandbox=best-effort`. These are the first `=` form, matched with `startsWith("--sandbox=")`; any other value is a usage error.
- Accepted with `--link` and by `nish run`. With only `-o x.ll`, the IR carries the call, and a link without `-DNISH_SANDBOX=1` fails on an undefined `nish_sandbox`, which fails closed.
- `--allow fs.read=<dir>` and `fs.write=<dir>` are accepted only with `--sandbox` (a usage error otherwise) and are repeatable.
- A directory is resolved to an absolute path at compile time, and must exist then.
- The mode goes in `runCacheKey` next to `--threads`. `linkProgram` passes `--sandbox` to `scripts/build.sh`, which adds `-DNISH_SANDBOX=1` to every runtime unit, following the `--threads` → `-DNISH_THREADS=1` shape.

### Platforms

| Target | `--sandbox` |
| --- | --- |
| Linux (x86_64, aarch64) | Landlock + seccomp |
| darwin host or `--target *-apple-darwin` | refused with the next free NL3xxx code ("not supported on macOS yet"), a stable code so tooling can match it; provoked on Linux through `--target` |
| `--profile wasi`, `--target wasm*` | accepted, no call emitted: WASI is already capability-scoped. Documented as such |
| no `main` (library, `--emit-header`, napi) | usage error: there is no wrapper to confine |

### Wrapper

- In `emitEntryWrapper`, before `nish_argv_init`: `call void @nish_sandbox(i32 <caps>, i32 <mode>, i8* <read dirs>, i8* <write dirs>)`.
- `<caps>` is `this.facts.get(userMain.name).caps`. Each directory list is a private constant of NUL-separated paths ending in an empty string, or `null` when unscoped.
- Add the symbol to `src/runtime.ts`'s table and the prototype to `runtime/nish.h` (two-sided; the prototype is unconditional). Add the nish-cmp DECLARED entry for `docs/cookbook/runtime-prelude.ll`.
- No shim or `runtime-wasm.c` twin is needed: it is not a builtin, and wasm emits no call.

### Runtime

- In `runtime/runtime-os.c`, the whole body sits under `#if defined(NISH_SANDBOX) && defined(__linux__)`, with `_GNU_SOURCE` defined only under that guard, so the default build is byte-identical. Where `NISH_SANDBOX` is set on a non-Linux host, the function aborts with a message, because the compiler already refused that case.
- Steps: `prctl(PR_SET_NO_NEW_PRIVS)`, then the Landlock ruleset, then the seccomp filter, then return. Any failure in strict mode prints `nish: --sandbox: <what> (<errno>)` to stderr and `_exit(<fixed status>)`, with the status chosen and documented in WP37.

### Mapping

**Landlock (file access):**
- The ruleset handles every filesystem right the running ABI reports, masked by the version.
- `fs.read` grants read-file and read-dir beneath each scoped dir, or beneath `/` when unscoped.
- `fs.write` grants the write rights (write-file, make-*, remove-*, truncate, refer) the same way.
- A missing capability grants nothing, so even `open` from C fails with EACCES.
- `process.spawn` adds execute and read beneath `/`, because the child must load. This is a documented widening, and the child inherits the domain.
- Descriptors that are already open (stdio) are unaffected.

**seccomp (BPF, with an architecture check):**
- Without `process.spawn`: kill on `execve`, `execveat`, `fork`, `vfork` and a `clone` without `CLONE_THREAD`; return `ENOSYS` on `clone3` so libc falls back to `clone`. `--threads` keeps working.
- Without `net`: kill on `socket`, `socketpair`, `connect`, `bind`, `listen`, `accept`, `accept4`.
- The kill action is `SECCOMP_RET_KILL_PROCESS`, so the process dies of SIGSYS and `nish run` reports 159.

**No Landlock** (`landlock_create_ruleset` → ENOSYS or EOPNOTSUPP):
- Strict mode fails with a message naming `--sandbox=best-effort`.
- Best-effort prints one stderr warning and continues with seccomp only.
- Missing seccomp is fatal in both modes.

**Testing the missing-kernel path:** add a compile-time `-DNISH_SANDBOX_SIMULATE_NO_LANDLOCK`, used only by the test that builds it. There must be no environment variable or runtime knob that can weaken the sandbox.

### Budget

- `runtime-os.c` is at 1,530 of 1,536, and the plain row must not move.
- Add a `-DNISH_SANDBOX=1` row with its own measured ceiling, following the `-DNISH_THREADS=1` rows for `runtime.c`, and record it in `docs/wp7-runtime.md`.
- Add a `-DNISH_SANDBOX=1 -Wall -Wextra -Werror` variant to the runtime unit tests.
- `.claude/architecture.md`'s budget table (its 1,393 is stale) gets the true figures.

### Security record

`docs/security/sandbox.md`, in the shape of `runtime.md`: Scope, Threat model, Method, Findings, Properties verified. Its threat model and the list of what it does *not* cover must name:
- an already-open descriptor
- reads of `/proc/self`
- `ptrace` and other syscalls not in the filter
- `ioctl` on existing fds
- signals to other processes
- time and entropy (not confined)
- `env` (the environment is already in memory)
- a kernel without Landlock under best-effort
- the `process.spawn` widening
- macOS, and the trust placed in the compiler's mask (a capability missed by the analysis is not confined)

Add its row to the Areas table in `docs/security/README.md`.

### Docs

- `docs/wp37-sandbox.md`.
- A `docs/LANGUAGE.md` rule under Capabilities.
- `docs/AI.md`: one line, "`--sandbox` makes the OS hold the program to its capabilities; on Linux only".
- A cookbook entry for the wrapper IR with and without `--sandbox`.
- `--help` and `AGENTS.md` rows.

## Tests

**Stage 1:**
- `tests/wordings/` cases for every new code: each refused capability through a two-module chain, the allowlist form, a manifest-only refusal, and a malformed manifest.
- `tests/link/` fixtures: one program that reaches only granted capabilities, with `args` `--allow fs.read,exit`, which runs with expected stdout; one manifest policy fixture; one `--deny unsafe` refusal.
- `tests/nish/cli.ts`: the usage errors (unknown name, allow and deny overlap, `=<dir>` without `--sandbox`, `--allow unsafe`), `nish run --deny net` refusing, and `--json` shape.
- Existing `.ll` goldens must not move. The `checked*.txt` goldens are regenerated with `node tests/self/goldens.js --update`, never edited.

**Stage 2:** bespoke checks in `tests/run.js` (not `tests/link`, where a signal death is a FAIL), shaped like `par_dst_short`:
1. FFI C helper calls `fork()` with no `process.spawn` → SIGSYS (159 under `nish run`).
2. FFI C helper calls `socket()` with no `net` → SIGSYS.
3. FFI C helper `open()`s a file with no `fs.read` → EACCES, printed by the program, exit 0.
4. `--allow fs.read=<tmpdir>` → `readFileSync` inside succeeds, and outside fails through its normal error path.
5. A program using only granted capabilities prints its expected stdout under `--sandbox`, also with `--threads`.
6. A runtime built with `-DNISH_SANDBOX_SIMULATE_NO_LANDLOCK` fails with the fixed status in strict mode and runs with one warning under best-effort.
7. `--target aarch64-apple-darwin --sandbox` → the NL3xxx code, in `tests/wordings`.
8. `--profile wasi --sandbox` emits no call (IR check).

Checks 3, 4 and 6 (strict) need Landlock. They probe once and `skip` with a named reason on a kernel without it, so the skip is counted. This container reports Landlock ABI 7. Whether `ubuntu-latest` has Landlock is unverified: the PR body must state what CI's run showed.

## Out of scope

- Per-dependency policies.
- Argument-level static checks (literal paths).
- Landlock's network rules: seccomp covers sockets.
- A macOS implementation (Seatbelt).
- Windows.
- Exposing the sandbox as a builtin.
- Confining `clock`, `entropy`, `env` or `signal` at the OS level: they are reported and policy-checked, not confined. The security record says so.
- Changing `CHANGELOG.md` by hand: it is generated from the squash commit.

## Verification

Per stage, from a fresh session with LLVM 18 and the current seed (`bash scripts/fetch-seed.sh` if `build/seed` is older than the last release — #414's acceptance found a stale 0.15.0 seed):
- `npm run check`
- `npm run lint && npm run lint:dead`
- `npm test`: read `N passed, M failed, K skipped`; no `DEGRADED:`; every skip named and environmental
- `npm run build && npm run test:cli`
- `node scripts/gen-diagnostic-codes.mjs --check`
