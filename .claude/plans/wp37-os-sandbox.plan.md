---
name: WP37 — the OS sandbox, written down
overview: WP35 computes what a program can reach and WP36 refuses at compile time what a policy does not grant; both point at a WP37 that has no note. This run writes docs/wp37-os-sandbox.md — `--sandbox` has the native main wrapper confine the process with Landlock and seccomp to main's computed capability set, and accepts the `fs.read=<dir>` scopes WP36 refuses — and moves every pointer to it. Design only; nothing is implemented.
stages:
  - id: note
    title: "docs: write WP37's note, the OS sandbox"
    goal: docs/wp37-os-sandbox.md exists with status Proposed and covers the flags, the wrapper call, the capability-to-Landlock/seccomp mapping, the kernel version floor, the fallbacks, the platforms, the tests, the out-of-scope list and the open questions; MASTER_PLAN.md's WP37 row, docs/README.md's index, and the WP35/WP36 "no note yet" pointers all link it; no file outside docs/ changes
    verification: node docs/check-links.mjs && npm run lint && npm run check && git diff --stat origin/main -- . ':!docs' | wc -l | grep -qx 0
    status: pending
    todos:
      - id: note-read
        content: Read docs/wp35-capabilities.md, docs/wp36-capability-policy.md, docs/LANGUAGE.md's Capabilities section, and Stage 2 of the earlier run's plan (`git show origin/feature/capability-sandbox/plan:.claude/plans/capability-sandbox.plan.md`, issue #451), then check every claim it makes against main's src/ and runtime/ — see Note, Sources
        status: pending
      - id: note-write
        content: Write docs/wp37-os-sandbox.md in the shape of the other wp notes — see Note, Contents
        status: pending
      - id: note-pointers
        content: Update MASTER_PLAN.md's WP37 item under "Next" to link the note, add the docs/README.md index row, and replace the "no note yet" / "not yet written" pointers in wp35 §7 and wp36's header and §2 with links — see Pointers
        status: pending
---

# WP37 — the OS sandbox, written down

## Context

WP35 (#423) computes eleven capability bits per function and reports
`main`'s closure. WP36 (#452) refuses at compile time a program that reaches a
capability its policy does not grant, and refuses `--allow fs.read=<dir>` as a
usage error because nothing at run time could hold a program to a path. Both
notes, and MASTER_PLAN.md's "Next" item 3, point at a WP37 with no note. The
earlier `/feature` run (#451) planned WP37 as its second stage and never
started it; its plan's Stage 2 is the best draft that exists and is the
starting point here, not the answer.

The user's ask: **write the note, update the MASTER_PLAN row, do not
implement.** No `src/`, `runtime/`, `tests/`, `scripts/` or guide change.

## Note

**Owns:** `docs/wp37-os-sandbox.md`, `docs/MASTER_PLAN.md`, `docs/README.md`,
`docs/wp35-capabilities.md`, `docs/wp36-capability-policy.md`

### Sources

Every `file:line`, symbol, exit code, budget figure and flag the note names is
checked against `main` at the commit the note states (CLAUDE.md, Security). In
particular verify, do not copy from #451's plan: the native `main` wrapper's
emitter and what it calls first; how `--threads` reaches `scripts/build.sh`
and the run-cache key; `runtime-os.c`'s current size against its ceiling in
`tests/runtime-budgets.js`; the next free NL3xxx code; how `nish run` reports
a signal death; which wasm/WASI profiles have a `main` wrapper at all.

### Contents

The note follows the house shape (`docs/wp36-capability-policy.md`,
`docs/wp35-capabilities.md`): a **Status: proposed** line, the WP35/WP36
relationship, then numbered sections. It must cover:

1. **Why** — what the compile-time analysis cannot see (C behind `ffi`, a
   runtime bug, a capability the analysis missed) and so what the sandbox
   adds; the sandbox confines to `main`'s *computed* set, not the policy.
2. **The flags** — `--sandbox` (strict) and `--sandbox=best-effort`; where
   they are accepted (`--link`, `nish run`) and refused (no `main`, `--fix`,
   `--emit-ast`, an `-o x.ll`-only compile and what it means for the IR);
   `--allow fs.read=<dir>` (and whether `fs.write=<dir>`) accepted only with
   `--sandbox`, repeatable, resolved at compile time; the manifest form; the
   run-cache key.
3. **The wrapper** — the one call the native `main` wrapper emits before user
   code, its arguments, the runtime symbol and where it lives, and that no
   `.ll` golden moves without the flag. Show the exact IR of the call.
4. **The mapping** — each of the eleven capabilities to Landlock rights, a
   seccomp rule, or "not confined, and why" (`clock`, `entropy`, `env`,
   `exit`, `signal`, `unsafe`, `ffi`); the `process.spawn` widening; the
   `--threads` interaction (`clone` with `CLONE_THREAD`, `clone3`); the kill
   action and the status a killed run exits with.
5. **The kernel version floor** — a table of Landlock ABI versions against the
   Linux release that added each and what Nish uses from it; seccomp-bpf,
   `SECCOMP_RET_KILL_PROCESS` and `PR_SET_NO_NEW_PRIVS`'s floors; which floor
   strict mode demands; what CI's `ubuntu-latest` runner and this container
   report, stated as measured or as unverified.
6. **The fallbacks** — no Landlock, an older Landlock ABI (rights masked
   down), no seccomp; strict versus best-effort for each; the fixed exit
   status and the message; that no environment variable or runtime knob can
   weaken it.
7. **Platforms** — Linux x86_64 and aarch64; macOS refused with a stable code;
   wasm and WASI; Windows.
8. **The tests** — each check, where it lives (`tests/run.js` bespoke checks
   versus `tests/link`, `tests/wordings`, `tests/nish/cli.ts`), what it
   asserts, which ones need Landlock and how they skip with a named reason,
   how the missing-kernel path is tested without a runtime knob, the runtime
   budget rows, and the CI step that greps a PASS line (CLAUDE.md's
   `/proc/cpuinfo` rule applies to a kernel-gated check too).
9. **What ships with it** — the `docs/security/sandbox.md` record and what it
   must say it does not cover, the LANGUAGE.md rule, the user-guide page, the
   AI.md line, the cookbook entry, the runtime-unit pairing if a new unit is
   added.
10. **Out of scope.**
11. **Open questions** — each one numbered, with the options and a
    recommendation, for the owner to decide before implementation starts.
    At least: `fs.write=<dir>`; the exit status; whether best-effort exists at
    all; seccomp's default action (allowlist versus denylist); the
    `process.spawn` widening; `/proc/self`; Landlock's network rules versus
    seccomp for `net`; whether `nish run` defaults to `--sandbox` one day.

### Pointers

- `docs/MASTER_PLAN.md`: the WP37 item under "Next" links
  `wp37-os-sandbox.md` and says the note is written and the work is proposed,
  not built.
- `docs/README.md`: an index row after `wp36`, "Proposed. …".
- `docs/wp35-capabilities.md` §7 and `docs/wp36-capability-policy.md` (header
  and §2, §6): "WP37's, not yet written" / "which has no note yet" become links
  to the note.
- Grep the tree for `WP37` before pushing (CLAUDE.md, "Moving where a fact
  lives"); today only those three files name it.

## Verification

`node docs/check-links.mjs`, `npm run lint`, `npm run check`, and the diff
confined to `docs/`. The commit is `docs: …` with a body written for the
release notes.

## Out of scope

Any implementation: `src/`, `runtime/`, `scripts/`, `tests/`, the user guide
and LANGUAGE.md move when WP37 is built, not when it is planned.
