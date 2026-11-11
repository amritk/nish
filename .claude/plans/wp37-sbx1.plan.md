---
name: WP37 — close SBX-1, the loader a granted program reaches
overview: WP37's one remaining stage that is not deferred. Under `--sandbox`, a dependency granted `process.spawn=<program>` gets an exec allowlist that also holds the program's interpreter (its ELF `PT_INTERP`, or its `#!` line's program), because the kernel opens that file for execution too. That interpreter is itself a program that runs whatever it is handed, so `spawnSync([loader, "/any/binary"])` escapes the grant (SBX-1, High, open in docs/security/sandbox.md). This plan closes it by marking the allowlist's interpreter-only entries and refusing them, by file identity, on the runtime's one spawn path, and lands the security record, the guide and the roadmap tick with it.
stages:
  - id: close-sbx1
    title: "fix(runtime): refuse a granted program's interpreter as a spawn target under --sandbox (WP37, SBX-1)"
    goal: Under --sandbox, a dependency granted process.spawn=<program> can start that program and nothing else — spawning the program's ELF loader or #! interpreter directly is refused — and SBX-1 is recorded fixed with a before/after test
    verification: npm run check; npm run lint; node tests/run.js "sandbox" (read its skip lines — the SBX-1 check must run, not skip, on a Landlock kernel; CI's Linux shards are the evidence where this container has no Landlock); node tests/run.js wasi (WASI_SYSROOT=/usr) and node tests/run.js performance; node scripts/security-scope.mjs; node scripts/gen-reference.mjs --check; node tests/self/goldens.js --update leaves the tree clean after commit; nish-cmp run per CLAUDE.md; every CI test shard green
    status: pending
    todos:
      - id: mark-interpreters
        content: In narrowSandbox (src/compilation.ts) and the wrapper's exec list (src/emit.ts sandboxDirs / @.sandbox.exec), mark every entry that is on the list only as another entry's interpreter (programInterpreter in src/capability-report.ts — ELF PT_INTERP and #! alike). A program the grant names explicitly stays spawnable even when it is also another program's interpreter. Choose the encoding (a marker byte, a second list, a sixth nish_sandbox operand) and say why in the PR body; update the IR snippet in docs/wp37-os-sandbox.md §2a to the new shape
      - id: runtime-refusal
        content: In runtime/runtime-sandbox.c, record the identity (st_dev, st_ino) of each interpreter-only entry when nish_sandbox applies the allowlist; in nish_spawn_start (runtime/runtime-os.c), resolve argv[0] the way posix_spawnp would and refuse a target whose identity matches one of them with a negative errno (EACCES), before any child starts. Compare by file identity, not by path, so a symlink, a second name (/lib64/ld-linux-x86-64.so.2 vs /usr/lib/...), or a hardlink to the loader is refused too. Without --sandbox, or with no exec allowlist, nothing changes
      - id: race
        content: Close the window between the identity check and the exec (a dependency holding fs.write could swap a symlink in its scope between them) — e.g. spawn the resolved real path, or the opened file itself — or, if it cannot be closed on this path, show why the swap cannot reach an interpreter-only entry and record that reasoning in the security record. Do not leave it unstated
      - id: tests
        content: Turn tests/run.js's SBX-1 pin into the after-test — "a granted program's ELF loader is refused as a spawn target (SBX-1)" — keeping the before half (without --sandbox, the same spawn runs the ungranted program). Add a check that the granted program itself still runs, one for a second name of the loader (a symlink to it in a scratch directory), one for a #! script grant whose interpreter is refused directly, and one where a program granted explicitly and also another's interpreter still runs. Update tests/link/sandbox_dep_exec_allowlist's golden .ll if the IR shape changes, and show the new IR in the PR body
      - id: record
        content: docs/security/sandbox.md — SBX-1 to Fixed, naming the commit's tests as its before/after; rewrite the Limits bullets that called the loader open; record what the fix still cannot reach (a granted program that is itself an interpreter, sh or python3, still runs anything — already a stated limit — and anything else the race todo concludes). Update the SBX-1 row in docs/security/README.md's index
      - id: guide-and-roadmap
        content: docs/guide/using-nish/sandbox.md — drop "recorded open as SBX-1" and state what a process.spawn grant now holds; docs/wp40-dependency-capabilities.md §2a's "(SBX-1, open)" sentence; docs/wp37-os-sandbox.md line 147's sentence; tick "Close SBX-1" in docs/roadmap/wp37-os-sandbox.md (Done 4 of 8, Next = the deferred stages or "none") and its row and line in docs/roadmap/index.md
      - id: goldens
        content: Regenerate tests/self/goldens/checked/ (node tests/self/goldens.js --update) and, if any nish-cmp corpus program's IR moved, add narrow DECLARED entries to tests/nish-cmp.js — never hand-edit a golden
---

# WP37 — close SBX-1

Requirements as given: `/feature wp-37` — finish WP37 (docs/roadmap/wp37-os-sandbox.md).
Its stages 1–3 are done; four are marked *deferred* on the roadmap page itself
(manifest scopes, IFUNC refusal, `nish run` sandboxed by default, a seccomp
allowlist mode), and the page's **Next** is SBX-1. This plan does SBX-1 alone;
the deferred stages stay deferred, as the roadmap says.

## close-sbx1

**Owns:** `src/compilation.ts`, `src/emit.ts`, `src/capability-report.ts`,
`runtime/runtime-sandbox.c`, `runtime/runtime-os.c`, `runtime/nish.h`,
`tests/run.js`, `tests/link/sandbox_dep_*/**`, `tests/self/goldens/checked/**`,
`tests/nish-cmp.js`, `tests/differential/**`, `docs/security/sandbox.md`,
`docs/security/README.md`, `docs/wp37-os-sandbox.md`,
`docs/wp40-dependency-capabilities.md`, `docs/guide/using-nish/sandbox.md`,
`docs/roadmap/wp37-os-sandbox.md`, `docs/roadmap/index.md`

### Why the fix lives where it does

Landlock checks EXECUTE at `execve` and at the kernel's open-for-exec of the
interpreter; it cannot tell "the kernel opening `ld.so` to start `/usr/bin/true`"
from "a program `execve`-ing `ld.so` directly", so the allowlist must keep
EXECUTE on the loader. What it can be told apart from is the *spawn request*:
every spawn builtin starts its child through `nish_spawn_start`, and under the
narrowed sandbox `main` does not reach `ffi`, so a dependency has no other way
to ask for an `execve`. The refusal therefore sits on that path and keys on the
file, not the name the dependency spelled.

### What stays out of scope

- A granted program that is itself an interpreter (`sh`, `python3`) runs
  whatever it is told — a stated limit already; this fix does not change it.
- What the granted program's own children exec: they inherit the Landlock
  domain, and a non-interpreter program does not exec its loader.
- The four deferred WP37 stages.

### Acceptance criteria

1. Built with `--sandbox` on a Linux kernel with Landlock, a program whose
   dependency is granted `process.spawn=<p>` (a dynamically linked `p`) and that
   spawns `[<p's ELF loader>, <an ungranted binary>]` gets a spawn failure and
   the ungranted binary prints nothing.
2. The same build, spawning `<p>` itself, runs it and gets its output and exit
   status 0.
3. Spawning the loader through a second name (a symlink to it) is refused the
   same way as criterion 1.
4. A dependency granted a `#!` script program cannot spawn that script's
   interpreter directly, and can still run the script.
5. A program the grant names explicitly stays spawnable even when it is also
   another granted program's interpreter.
6. Built without `--sandbox`, spawning `[<loader>, <binary>]` still runs the
   binary (no change outside the sandbox).
7. `docs/security/sandbox.md` and the `docs/security/README.md` index show
   SBX-1 as fixed, with the test names that are its before/after, and
   `node scripts/security-scope.mjs` passes.
8. The roadmap shows WP37 at 4 of 8 with "Close SBX-1" ticked, and the user
   guide's sandbox page no longer calls SBX-1 open.
