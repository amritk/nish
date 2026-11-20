---
name: WP37 — the OS sandbox, the deferred stages
overview: --sandbox with Landlock and seccomp has landed, along with its scopes, dependency grants and the exec allowlist. Four stages are deferred (manifest scopes, an IFUNC link-time refusal, a sandboxed nish run by default, and a seccomp allowlist flag), each waiting on a trigger the design note names.
roadmap: docs/roadmap/wp37-os-sandbox.md
spec: docs/wp37-os-sandbox.md
priority: 80
labels: [deferred]
issue: 1909
stages:
  - id: s6-manifest-scopes
    title: WP37 S6 — scopes in the package.json manifest
    goal: A package.json nish field can carry sandbox scopes resolved against the package root, and a scope that escapes the root or names a path that is not there is refused with a diagnostic.
    verification: node tests/run.js sandbox && node tests/run.js link && npm run lint
    status: pending
    labels: [deferred]
    issue: 1925
    todos:
      - id: s6-decide-trigger
        content: Record in docs/wp37-os-sandbox.md section 11 question 1 what reopens the manifest-scope stage and what a relative scope means in a published package — see WP37 S6 — scopes in the package.json manifest
        status: pending
      - id: s6-manifest-parse
        content: Parse the sandbox scopes of the nish field and resolve them against the package root in src/, failing closed on anything it cannot parse — see WP37 S6 — scopes in the package.json manifest
        status: pending
      - id: s6-negatives
        content: Add a tests/link negative with an expected.err for a scope that leaves the package root, and update docs/guide/using-nish/sandbox.md and docs/security/sandbox.md — see WP37 S6 — scopes in the package.json manifest
        status: pending
  - id: s7-ifunc
    title: WP37 S7 — refuse IFUNC resolvers at link time
    goal: A link that carries an ffi object with an STT_GNU_IFUNC symbol or an IRELATIVE relocation is refused under --sandbox, with a diagnostic and a tests/link negative.
    verification: node tests/run.js sandbox && node tests/run.js link && npm run lint
    status: pending
    labels: [deferred]
    issue: 1927
    todos:
      - id: s7-symbol-scan
        content: Scan each ffi object's symbol table on the link path for STT_GNU_IFUNC and R_*_IRELATIVE under --sandbox — see WP37 S7 — refuse IFUNC resolvers at link time
        status: pending
      - id: s7-diagnostic
        content: Add the diagnostic code in src/codes.ts with a tests/link negative that provokes it, and regenerate docs/reference/diagnostics — see WP37 S7 — refuse IFUNC resolvers at link time
        status: pending
      - id: s7-record
        content: Move the IFUNC limit in docs/security/sandbox.md from a stated limit to a fixed finding, and say a shared library's resolvers are still out of reach — see WP37 S7 — refuse IFUNC resolvers at link time
        status: pending
  - id: s8-run-default
    title: WP37 S8 — nish run sandboxed by default
    goal: A note decides whether and when nish run defaults to --sandbox, and if it does the default ships with a documented opt-out and the older-kernel behaviour pinned by a test.
    verification: node tests/run.js sandbox && node tests/run.js cli && npm run lint
    status: pending
    labels: [deferred]
    issue: 1928
    todos:
      - id: s8-note
        content: Write the proposal note for a default sandbox in nish run, answering open question 10 with the CI measurement of Landlock on every runner — see WP37 S8 — nish run sandboxed by default
        status: pending
      - id: s8-default
        content: Make src/ nish run apply --sandbox unless told otherwise, if the note's decision is yes — see WP37 S8 — nish run sandboxed by default
        status: pending
  - id: s9-seccomp-allowlist
    title: WP37 S9 — a seccomp allowlist mode, as its own flag
    goal: A separate flag confines a program to the syscalls its runtime makes, with the denylist mode unchanged and a test that a libc or ffi callee outside the list is killed.
    verification: node tests/run.js sandbox && node tests/run.js c-symbols && npm run lint
    status: pending
    labels: [deferred]
    issue: 1929
    todos:
      - id: s9-list
        content: Derive the allowlist from the syscalls the runtime and the compiler's computed capabilities need in runtime/runtime-sandbox.c — see WP37 S9 — a seccomp allowlist mode, as its own flag
        status: pending
      - id: s9-flag
        content: Add the flag in src/ and its docs/guide/using-nish/sandbox.md section, leaving the denylist default as is — see WP37 S9 — a seccomp allowlist mode, as its own flag
        status: pending
---

# WP37 — the OS sandbox, the deferred stages

## Context
Landed: `--sandbox` and `--sandbox=best-effort`, the `fs.read` and `fs.write` scopes, dependency-grant scopes, the exec allowlist, SBX-1 and `process.spawn=exec:<program>` — see [the roadmap page](../../docs/roadmap/wp37-os-sandbox.md) (5 of 9 done). The four boxes left are all marked deferred and none is scheduled. Design note: [docs/wp37-os-sandbox.md](../../docs/wp37-os-sandbox.md); security record: `docs/security/sandbox.md`. No GitHub issue is assigned to this plan.

## WP37 S6 — scopes in the package.json manifest
The note's section 11 question 1 recommends scopes on the command line first and the manifest later, because a relative scope in a published package names a directory on someone else's machine. The stage resolves them against the package root and fails closed (the CLAUDE.md rule on package-controlled input). Likely files: `src/` manifest reader, `docs/guide/using-nish/sandbox.md`, `docs/security/sandbox.md`.

## WP37 S7 — refuse IFUNC resolvers at link time
An IFUNC resolver runs during relocation, before the preinit call, so an ffi object or a needed shared library can run code unconfined (question 11). The note recommends stating the limit now and refusing in a later stage. Costs it names: a symbol-table pass on the link path, refusing libraries that use IFUNC for CPU dispatch (libgcc does), and no reach into a shared library's resolvers. Likely files: the link path in `src/`, `runtime/runtime-sandbox.c`.

## WP37 S8 — nish run sandboxed by default
Question 10 recommends option (c), once CI has measured Landlock on every runner, proposed in its own note, because a default that refuses to start on older kernels is a break the stability rule in LANGUAGE.md would have to allow. First deliverable is that note.

## WP37 S9 — a seccomp allowlist mode, as its own flag
Question 4 recommends the denylist first because an allowlist breaks on every libc and kernel update and on every ffi callee; an allowlist is "a later, separate flag". Likely files: `runtime/runtime-sandbox.c`, `src/` flag parsing.
