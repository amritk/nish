---
name: Hold a granted program's descendants to the exec grant under --sandbox
overview: Under `--sandbox`, a dependency granted `process.spawn=<p>` runs `<p>`, but a granted program's descendants could still reach the loader the exec allowlist carries for it. Stage 1 makes every program started under an exec allowlist exec-less (a one-shot exec filter per spawn) and lands the security record with it. Stage 2 adds a per-program opt-in for programs that must start helpers.
stages:
  - id: exec-once
    title: "fix(runtime): hold a granted program's descendants to the exec grant"
    goal: Under an exec allowlist, a spawn's child may complete exactly one exec (the granted program's own start); nothing in its subtree can exec again, and SBX-1's status is honest in the same commit
    verification: npm run check && npm run lint && node tests/run.js sandbox && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node scripts/security-scope.mjs && node tests/nish-cmp.js
    todos:
      - id: exec-once-design-note
        content: Write the design as a new subsection of docs/wp37-os-sandbox.md §2a (mechanism, the directions weighed and what each leaves open, fallbacks) — see The design, Directions weighed
        status: pending
      - id: exec-once-runtime
        content: Implement the one-shot exec filter on the sandboxed spawn path in runtime/runtime-sandbox.c behind the nish_spawn_target hook of runtime/runtime-os.c — see The design, Runtime shape
        status: pending
      - id: exec-once-check-window
        content: Make the spawn-target identity check and the exec use a descriptor no other thread of the process can replace, or record why it cannot be — see The check window
        status: pending
      - id: exec-once-fallbacks
        content: Refuse the spawn, in both modes, when the kernel cannot install or answer the filter; one stderr line, fail closed — see Fallbacks
        status: pending
      - id: exec-once-tests
        content: Add before/after checks to the `sandbox dependency grants` block of tests/run.js with new tests/link/sandbox_dep_exec_* fixtures — see Tests
        status: pending
      - id: exec-once-budgets
        content: Re-measure runtime-sandbox.c and runtime-os.c against tests/runtime-budgets.js and move the ceiling and its docs/wp7-runtime.md row by the measured amount only — see Budgets and goldens
        status: pending
      - id: exec-once-record
        content: Update SBX-1 in docs/security/sandbox.md (the residual, its fix, before/after test names, Limits, Scope row, Tests) and the docs/security/README.md index row; triage any new CodeQL alert in docs/security/runtime.md — see The record
        status: pending
      - id: exec-once-docs
        content: State what a `process.spawn=<program>` grant now allows in docs/guide/using-nish/sandbox.md, docs/wp40-dependency-capabilities.md §2a and the spawn builtins' doc comments in runtime/nish.d.ts; regenerate docs/reference — see User-facing docs
        status: pending
      - id: exec-once-goldens
        content: Regenerate tests/self/goldens/checked and docs/reference with the repo's tooling and run nish-cmp; add DECLARED entries only if a corpus program's IR moves — see Budgets and goldens
        status: pending
  - id: exec-optin
    title: "feat(checker): a process.spawn grant that lets a program start helpers"
    goal: A grant can name a program whose subtree keeps the exec allowlist's reach (today's behaviour), so git- and sh-style programs work under an exec allowlist by an explicit, recorded choice
    verification: npm run check && npm run lint && node tests/run.js sandbox && node tests/run.js caps_dep && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node scripts/security-scope.mjs && node tests/nish-cmp.js && node scripts/gen-reference.mjs --check
    todos:
      - id: exec-optin-syntax
        content: Parse the `process.spawn=exec:<program>` grant argument where grant arguments are resolved (src/compilation.ts and the grant checks), with its refusals — see The opt-in, Syntax
        status: pending
      - id: exec-optin-mark
        content: Carry the opt-in to the runtime as a mark on the program's @.sandbox.exec entry and skip the one-shot filter for a spawn whose target carries it — see The opt-in, Runtime
        status: pending
      - id: exec-optin-tests
        content: Add a positive and a negative link fixture and their tests/run.js checks, and a caps_dep case for a malformed opt-in — see The opt-in, Tests
        status: pending
      - id: exec-optin-record
        content: Record the opt-in as a Limit in docs/security/sandbox.md and document it in the guide's sandbox page, docs/wp40-dependency-capabilities.md §2a and docs/wp37-os-sandbox.md §2a — see The opt-in, Docs
        status: pending
      - id: exec-optin-goldens
        content: Regenerate tests/self/goldens/checked, docs/reference and the diagnostic-code tables if a code is added; run nish-cmp — see Budgets and goldens
        status: pending
---

# Hold a granted program's descendants to the exec grant under --sandbox

## Requirement

Under `--sandbox`, a dependency granted `process.spawn=<p>` runs `<p>`. Neither
`<p>` nor anything it starts can execute a file outside the grant, including
the loader the kernel needs to start `<p>`. Without `--sandbox` nothing
changes.

The owner decided on 2026-11-12 to fix this under the normal repo rules. Until
stage 1 merges, PR bodies, PR comments and issue text describe it only as "a
granted program's descendants could still reach the loader"; the worker's
brief carries the detail.

## The design

**One exec per spawn.** When the build carries an exec allowlist
(`@.sandbox.exec`, so `nish_spawn_target` is set), every spawn's child takes a
seccomp filter of its own before its `execve`:

- `execve` and `execveat` answer `SECCOMP_RET_USER_NOTIF`; everything else is
  allowed (the process-wide filter of §4 still applies on top).
- The filter is installed with `SECCOMP_FILTER_FLAG_NEW_LISTENER`. The runtime
  holds the listener, answers the **first** notification with
  `SECCOMP_USER_NOTIF_FLAG_CONTINUE`, answers any other that arrives before
  the spawn call returns with an error, and closes the listener.
- With the listener closed the kernel answers every later `execve` and
  `execveat` in that subtree `ENOSYS`, for good: the filter is inherited by
  every descendant and cannot be removed.

The state the scheme needs ("has the one exec happened") is held by the kernel
(listener open or closed), not by anything the subtree can write. The first
notification can only come from the runtime's own child, because the granted
program does not exist until that exec completes.

The spawn-target refusal SBX-1 added stays: the one exec the filter allows
must still not be the loader, named directly by the Nish program.

### Runtime shape

A filter is irrevocable on the thread that takes it, and `posix_spawnp` gives
no hook between `clone` and `execve`. Two shapes work; the worker picks one
and says why in the design note:

1. **A helper thread per spawn.** A short-lived thread installs the filter on
   itself (no `TSYNC`), publishes the listener, and calls `posix_spawnp` as
   today; the spawning thread answers the notification. `posix_spawnp`'s file
   actions are reused unchanged. Prototyped by the lead on Linux 6.18 with a
   Landlock exec allowlist: the program runs, and a second exec from it is
   answered `ENOSYS`.
2. **A raw `clone` child** that installs the filter itself and hands the
   listener back (a shared descriptor table, then `unshare(CLONE_FILES)`),
   which means re-implementing the file actions with async-signal-safe calls.

Either way the spawning thread must not block forever when the child dies
before its exec (a failed redirect): wait on the listener and on the spawn's
completion together.

All of it lives in `runtime/runtime-sandbox.c` behind the existing hook, so a
program built without `--sandbox` links none of it and `nish_spawn_start`'s
unsandboxed path is byte-for-byte what it was.

### The check window

Today the target is opened and identity-checked in the process's shared
descriptor table, then executed by number. Another thread of the same process
can close and reopen descriptors (`fileClose`, `fileOpen`). The worker
establishes whether the checked descriptor can be replaced before the child
copies the table and, if so, closes it in this stage (shape 1 can
`unshare(CLONE_FILES)` in the helper thread before it opens and checks) or
records it as a Limit with the reason. Its detail follows the same
non-disclosure rule as the rest.

### Fallbacks

- A kernel or container that cannot install the filter with a listener or
  answer it (`seccomp` refusing `NEW_LISTENER` or `CONTINUE`: Linux before 5.5,
  a runtime without user notification, a launcher whose own seccomp profile
  already holds a listener and answers `EBUSY`): the spawn is refused with a
  negative errno, in strict and best-effort alike. Strict needs Landlock
  (5.13), so in strict this is a container limit, not a kernel-version one.
- No exec allowlist (`process.spawn` granted whole, or not narrowed): no
  filter, as today.

### Directions weighed

The design note records each with what it leaves open:

| Direction | Verdict | Leaves open |
| --- | --- | --- |
| One exec per spawn, by a closed listener (chosen) | Closes exec in the subtree with kernel-held state | A granted program cannot start a second program, granted or not; interpreters the grant names still run what they are told; needs seccomp user notification |
| `execveat(dirfd == N, AT_EMPTY_PATH)` allowed by number | Ruled out | `dirfd` is ignored for an absolute pathname, which seccomp cannot read, so the rule admits any path; the `dup2` route need not be argued |
| Allow `execve` by the caller's instruction pointer | Ruled out | Probabilistic: any address is mappable after the exec, and with ASLR off a shared libc sits at one address in both images |
| A second Landlock layer in the child | Ruled out | The layer must still grant EXECUTE on the loader for the program's own start, and is inherited as is |
| (b) Refuse grants of programs known to exec | Not enforcement | A list of names is never complete (`find`, `xargs`, `env` are examples, not the set) |
| (c) Statically linked programs only | Too narrow | Almost no distribution program qualifies; a `#!` script never does |
| A supervisor that answers every exec by path | Not chosen | Would let a subtree exec other granted programs, at the cost of a permanent supervisor thread reading another process's memory |
| Namespaces | Ruled out here | Refused on CI's runners, so it could not be the tested enforcement |

## Tests

In `tests/run.js`'s `sandbox dependency grants` block, each before/after
against the same build without `--sandbox`, each a counted SKIP where the
machine cannot run it (no Landlock, no `clang`), never a silent pass:

- a granted program that executes a path from its arguments cannot run a
  second program, the loader included (two programs of different shape, so the
  check is not one tool's behaviour);
- a granted program still runs and exits 0; a granted `#!` script still runs;
- every existing SBX-1 check passes unchanged;
- a spawn whose child fails before its exec returns its error and does not
  hang;
- `spawn`, `spawnSyncTo`, `spawnWithFds`, `spawnPiped` and `spawnPipedWithin`
  each start a granted program under the filter (they share
  `nish_spawn_start`; one check per entry point that has a distinct path).

The helper programs the checks need are built by the check (as SBX-1's
`sbx-1-ungranted` is), not taken from the machine, where a multicall
coreutils changes behaviour by `argv[0]`.

## Budgets and goldens

`tests/runtime-budgets.js` ceilings move only by a measured amount, with the
row in `docs/wp7-runtime.md`. `tests/self/goldens/checked/` and
`docs/reference/` are regenerated with `node tests/self/goldens.js --update`
and `node scripts/gen-reference.mjs`, never edited. `node tests/nish-cmp.js`
runs before the push; a moved corpus IR gets a narrow `DECLARED` entry.

## The record

`docs/security/sandbox.md`: SBX-1's row says what was still reachable after
the first fix and how this closes it, with the new test names as its
before/after; Limits gains what the filter costs (no second program from a
granted one, the user-notification requirement, the fail-closed fallbacks) and
loses any sentence the fix makes untrue; the Scope row names the new
functions; Tests lists the new checks. `docs/security/README.md`'s index row
follows. SBX-1 must read true at the merge commit: the record and the fix land
together.

## User-facing docs

`docs/guide/using-nish/sandbox.md` states what a `process.spawn=<program>`
grant allows under `--sandbox`: the program runs, it cannot start another, and
how to grant a program that must (stage 2's opt-in once it lands; until then,
`process.spawn` whole). `docs/wp40-dependency-capabilities.md` §2a and the
spawn builtins' doc comments say the same in one sentence each.

## The opt-in

**Syntax.** `"process.spawn=exec:<program>"` grants the program as
`process.spawn=<program>` does and keeps its subtree's reach of the exec
allowlist. The prefix is read before the program is resolved; an empty program
after it is refused like a program that is not found. A program granted both
ways is exec-capable.

**Runtime.** The compiler marks the entry in `@.sandbox.exec` (a spelling of
the path no real path carries, as `//` is for interpreters); the runtime keeps
those identities and starts such a target without the one-shot filter.

**Tests.** A fixture whose granted `exec:` program starts a helper and
succeeds; the same grant without the prefix, where the helper is refused; a
`caps_dep` case for the malformed form.

**Docs.** The opt-in is a Limit: a program granted this way reaches the
loader, so it runs anything. The guide says to grant it only to a dependency
that may run anything.

## Stage exec-once

**Owns:** `runtime/runtime-sandbox.c`, `runtime/runtime-os.c`, `runtime/nish.h`, `runtime/nish.d.ts`, `scripts/build.sh`, `src/compilation.ts`, `src/capability-report.ts`, `tests/run.js`, `tests/runtime-budgets.js`, `tests/nish-cmp.js`, `tests/link/sandbox_dep_*/**`, `tests/self/goldens/checked/**`, `docs/wp37-os-sandbox.md`, `docs/wp40-dependency-capabilities.md`, `docs/wp7-runtime.md`, `docs/security/sandbox.md`, `docs/security/README.md`, `docs/security/runtime.md`, `docs/guide/using-nish/sandbox.md`, `docs/roadmap/wp37-os-sandbox.md`, `docs/reference/**`

## Stage exec-optin

Starts after `exec-once` merges: it consumes the runtime's mark handling.

**Owns:** `src/compilation.ts`, `src/capability-report.ts`, `src/codes.ts`, `runtime/runtime-sandbox.c`, `runtime/nish.h`, `tests/run.js`, `tests/runtime-budgets.js`, `tests/nish-cmp.js`, `tests/link/sandbox_dep_*/**`, `tests/link/caps_dep_*/**`, `tests/self/goldens/checked/**`, `docs/wp37-os-sandbox.md`, `docs/wp40-dependency-capabilities.md`, `docs/wp7-runtime.md`, `docs/security/sandbox.md`, `docs/security/capabilities.md`, `docs/guide/using-nish/sandbox.md`, `docs/LANGUAGE.md`, `docs/reference/**`
