---
name: Builtins a credential-storing CLI needs — replace and remove files, files and directories with a mode, exclusive create, byte output, a piped child
overview: Three PRs, one changelog line each, run one after another because every builtin registers in the same files. Every new builtin follows runtime/nish.d.ts's newer contract — i32, >= 0 on success, a negative Linux errno otherwise (never a panic, so a CLI can report and carry on), paths and argv refused with -22 on an embedded NUL as nish_cpath does, descriptors close-on-exec — and ships with its golden .ll, an llvm-as pass, a native round trip with expected stdout, at least one negative test, its capability label in src/capabilities.ts, its docs/LANGUAGE.md row, docs/AI.md and llms.txt lines, and its docs/guide entry. Under Node (--emit-ts) each one is implemented with the matching node:fs / node:child_process call where Node can express it, and documented where it differs.
stages:
  - id: fs-replace-bytes
    title: "feat(runtime): renameSync, unlinkSync and u8[] output in nish:fs and nish:io"
    goal: A program can atomically replace a file with renameSync(from, to), remove one with unlinkSync(path), and write a u8[] to stdout and to a file byte-for-byte on every target — and docs/LANGUAGE.md answers, with a test, whether a string already carries arbitrary bytes
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/security-scope.mjs && node tests/run.js rename && node tests/run.js unlink && node tests/run.js bytes && node tests/run.js caps && node tests/run.js wasi && node tests/run.js performance; every CI test shard green and undegraded
    status: pending
    todos:
      - id: rb-answer
        content: Pin the bytes answer first, with a native round trip — a string built by String.fromBytes over all 256 byte values (NUL and 0xFF included) goes through write() and writeFileSync() and comes back byte-identical (cmp against a .bin golden). The survey says native strings are {len, bytes}, unvalidated, written length-delimited, so this should pass today; under --emit-ts String.fromBytes decodes as UTF-8 and turns invalid sequences into U+FFFD (runtime/core/strings.mjs), so the string route is native-only. Record both facts in docs/LANGUAGE.md's String section and the File I/O section
      - id: rb-bytes
        content: Because the string route corrupts bytes under --emit-ts, add writeBytes(bytes: readonly u8[], off: i32, len: i32): i32 to nish:io (stdout, all bytes or a negative errno, EINTR/partial writes retried as nish_write_all does) and writeFileBytesSync(path: string, bytes: readonly u8[]): i32 to nish:fs (the counterpart of readFileBytesSync; O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW|O_CLOEXEC, 0644 like writeFileSync). Node bodies via process.stdout fd / fs.writeFileSync with a Uint8Array. If the off/len shape reads wrong next to netWrite, match netWrite and say why in the PR
      - id: rb-rename-unlink
        content: renameSync(from, to): i32 (rename(2): atomic replace on one filesystem, -18 EXDEV across them, documented) and unlinkSync(path): i32 (unlink(2); a directory is -21 EISDIR/-1 EPERM as the kernel says, never rmdir). Node bodies via fs.renameSync/fs.unlinkSync mapping err.errno to the negative errno
      - id: rb-register
        content: The full builtin chain the survey lists — runtime/nish.d.ts (global + nish:fs / nish:io copies), src/builtins.ts (name list, signature check, refuseOnWasm for the freestanding wasm target; WASI follows writeFileSync's neighbours), src/nish-modules.ts, src/capabilities.ts (fs.write for all four except writeBytes, which is labelled like write), src/emit-builtins.ts, src/runtime.ts + runtime/nish.h + runtime/runtime-os.c (or runtime.c for writeBytes, beside nish_write_all), src/escape.ts / src/statements.ts / src/symbols.ts only if a builtin allocates, src/emit-ts-edits.ts AMBIENT_NAMES, runtime/node.mjs, runtime/core/host.mjs + host.d.ts, runtime/nish.mjs, docs/cookbook/runtime-prelude.ts
      - id: rb-tests
        content: tests/cases — io_rename (replace an existing target; the source is gone; a missing source is -2 and the program continues), io_unlink (removes; a missing path is -2; a directory is refused), io_write_bytes (stdout all 256 values, compared byte-for-byte), io_write_file_bytes; a caps_ case whose .caps.json shows the labels; reject_ cases for arity and argument type of each; goldens .ll + llvm-as; registered in tests/differential and tests/nish-cmp.js DECLARED; checked goldens regenerated; tests/runtime-budgets.js raised with the measurement if runtime-os.c grows past it
      - id: rb-docs
        content: docs/LANGUAGE.md (nish:fs / nish:io module table, File I/O table, Capabilities table), docs/wp35-capabilities.md if it restates the table, docs/AI.md "Files and the system", llms.txt, docs/guide/language/modules.md rows and docs/guide/using-nish/standard-library.md prose — the guide states the bytes answer in one sentence; docs/security/runtime.md scope line for the new runtime functions
  - id: fs-modes-exclusive
    title: "feat(runtime): files and directories with an explicit mode, and exclusive create, in nish:fs"
    goal: A program can write a secret file that is 0600 even when the path already existed with wider permissions, create a 0700 directory, and create a lock file with O_CREAT|O_EXCL so exactly one of several racing processes wins
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/security-scope.mjs && node tests/run.js mode && node tests/run.js excl && node tests/run.js caps && node tests/run.js wasi && node tests/run.js performance; every CI test shard green and undegraded
    status: pending
    todos:
      - id: fm-write-mode
        content: writeFileSyncMode(path: string, data: string, mode: i32): i32 — open O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW|O_CLOEXEC with mode, then fchmod(fd, mode) BEFORE writing a byte, so a pre-existing 0644 file never holds the new data at 0644 and the result is exactly `mode` (umask cannot widen it; fchmod is what makes it exact). A mode outside 0..0o7777 is -22. Document that a symlink at the path is refused (-40 ELOOP) and that callers wanting crash-safety write a temp file with this and renameSync it into place
      - id: fm-mkdir-mode
        content: mkdirSyncMode(path: string, mode: i32): i32 — mkdir(2) with mode; an existing path is -17 and its mode is NOT changed (documented, so a caller checks rather than trusts); the result is mode & ~umask, documented, with a note that a caller needing exactly 0700 under an unusual umask has it already (0700 is unaffected by any umask that leaves the owner bits)
      - id: fm-exclusive
        content: An exclusive create — createFileExclusiveSync(path: string, data: string, mode: i32): i32, O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC; -17 when the path exists (a dangling symlink included); writes data (e.g. a pid) and closes. The name may change in review if a neighbour's convention reads better; the PR says what it chose
      - id: fm-register
        content: The full builtin chain as in fs-replace-bytes (nish.d.ts global + nish:fs, builtins.ts, nish-modules.ts, capabilities.ts fs.write, emit-builtins.ts, runtime.ts, nish.h, runtime-os.c, emit-ts-edits.ts, node.mjs via fs.openSync/fchmodSync/writeSync with flags 'wx' for the exclusive form, core/host.mjs + host.d.ts, nish.mjs, cookbook prelude)
      - id: fm-tests
        content: Native round trips — a new file at 0o600 stats 0600; a pre-existing 0644 file ends 0600 with the new content; a symlink at the path is refused and its target untouched; mkdirSyncMode 0o700 stats 0700 and a second call is -17; createFileExclusiveSync succeeds once then answers -17; a lock race (spawn N children via spawn/waitPid, each tries the exclusive create, exactly one reports success); reject_ cases for arity and types; caps_ report; goldens, differential and checked goldens
      - id: fm-docs-security
        content: docs/LANGUAGE.md rows and Capabilities table, docs/AI.md, llms.txt, docs/guide/language/modules.md + standard-library.md (a short "writing a secret to disk" paragraph: mode, symlink refusal, temp-then-rename), docs/security/runtime.md — findings for the mode race (pre-existing file, fchmod before write), symlink following, and umask, each fixed with a test or recorded open
  - id: spawn-piped
    title: "feat(runtime): spawnPiped runs a child with stdin from memory and stdout/stderr captured"
    goal: A program can run a child by absolute path or PATH search, feed it a u8[] on stdin, and read back its exit status, stdout and stderr as u8[] — so a secret reaches `/usr/bin/security -i` or `secret-tool store` on a pipe and never appears in argv, the environment, or a file
    verification: npm run check && npm run lint && npm run lint:dead && node docs/check-links.mjs && node scripts/security-scope.mjs && node tests/run.js spawn && node tests/run.js caps && node tests/run.js wasi && node tests/run.js performance; every CI test shard green and undegraded
    status: pending
    todos:
      - id: sp-shape
        content: Decide the result shape. The requested one is `spawnPiped(argv: string[], stdin: readonly u8[]): {status, stdout: u8[], stderr: u8[]}`, but no builtin returns a record today (src/builtins.ts's waitPid comment — no tuple, and a class needs a declaration no program wrote). Prefer a declared result type in runtime/nish.d.ts (e.g. `interface SpawnResult { status: i32; stdout: u8[]; stderr: u8[] }`, exported from nish:process) if the checker can give a builtin a nominal return type in a bounded change; otherwise caller-owned out-params (`spawnPiped(argv, stdin, stdout: u8[], stderr: u8[]): i32` appending to growable arrays). Write the decision and the rejected option in docs/LANGUAGE.md beside the spawnSyncTo rationale, which refused in-memory capture for unbounded output — so add a byte cap (a documented ceiling, or a cap parameter) past which the child is killed and the call answers a distinct negative code, rather than buffering without bound
      - id: sp-runtime
        content: runtime-os.c — posix_spawnp (PATH search; an argv[0] with a slash is used as given) with three O_CLOEXEC pipes and file actions; the parent drives stdin writes and stdout/stderr reads through one poll(2) loop with non-blocking fds so a child that fills its stdout before draining stdin cannot deadlock either side; EPIPE/SIGPIPE from a child that closes stdin early is not fatal (MSG/sigaction-free: block SIGPIPE for the write or use the fd flag the platform offers) and is reported; EINTR retried; waitpid for the status with the same encoding spawnSync uses (exit code, or 128+signal — match the neighbour); every fd closed on every path; Linux and Darwin. The stdin buffer is the caller's — the runtime copies nothing it would then have to wipe; say so in the record
      - id: sp-register
        content: Full builtin chain — nish.d.ts global + nish:process, builtins.ts (checkBuffer for the u8[] argument, refuseOnWasm and the WASI refusal the other spawns have), nish-modules.ts, capabilities.ts process.spawn, emit-builtins.ts with isSpawnCall's escape rule extended to the argv of spawnPiped, runtime.ts effect attributes (not willreturn, as the other spawns), nish.h, escape.ts / statements.ts / symbols.ts for the arena-owned u8[] results, emit-ts-edits.ts, node.mjs via child_process.spawnSync with `input` and maxBuffer matching the cap, core/host.mjs + host.d.ts, nish.mjs, cookbook prelude
      - id: sp-tests
        content: Native round trips — `cat` echoes all 256 byte values; a >1 MiB stdin through `cat` completes (proves no pipe deadlock); stdout and stderr captured separately (`sh -c 'printf out; printf err >&2; exit 3'` gives status 3); PATH search and absolute path both work; a missing program answers the spawnSync-equivalent failure; a child that exits without reading stdin does not kill the parent; the cap kills a `yes` child and answers the cap code; the secret is not in the child's argv (the child prints its own argv / /proc/self/cmdline); mem_ scope case for the arena results; reject_ cases for arity, argv element type and stdin type; caps_ report; tests/runtime-test.c RT case if the record fixes a finding there; goldens, differential, checked goldens, runtime budget
      - id: sp-docs-security
        content: docs/LANGUAGE.md (nish:process table, "Directories and subprocesses", Capabilities), docs/AI.md "Children and the machine", llms.txt, docs/guide/language/modules.md + standard-library.md with a worked example handing a secret to a keychain tool on stdin, docs/security/runtime.md — scope extended to spawnPiped (it reads another process's output into memory), findings for deadlock, unbounded output, SIGPIPE, fd leaks into the child, argv/environment exposure, each fixed with a before/after test or recorded open, and the README index row updated
---

# Builtins a credential-storing CLI needs

## The bytes question, answered before anything is built

The request makes `u8[]` output conditional on whether a string already
carries arbitrary bytes. It does natively: `runtime/nish.h` lays a string out as
`{len, bytes[len], 0}` and says it may contain NULs, nothing validates UTF-8,
`String.fromBytes` builds one from any bytes, and both `write` and
`writeFileSync` write `len` bytes (`nish_write_all`, `nish_put_file`), never
`strlen`. Under `--emit-ts` it does not: `runtime/core/strings.mjs` decodes
`String.fromBytes`'s bytes as UTF-8 and turns invalid sequences into U+FFFD.
So the string route works for a native binary and corrupts a binary body in an
emitted TypeScript build. `fs-replace-bytes` pins the native half with a test,
documents both halves, and adds `writeBytes` / `writeFileBytesSync` so byte
output is exact on every target.

## Why one after another

Every builtin registers in the same files: `runtime/nish.d.ts`,
`src/builtins.ts`, `src/nish-modules.ts`, `src/capabilities.ts`,
`src/emit-builtins.ts`, `src/runtime.ts`, `runtime/nish.h`, `runtime/node.mjs`,
`runtime/core/host.mjs`, `runtime/nish.mjs`, `docs/LANGUAGE.md`, `docs/AI.md`,
`llms.txt`, plus the generated goldens. Two stages editing the same table rows
at once conflict by construction, so each stage starts when the previous one
merges. Each is worth merging alone and is one changelog line.

The run `runtime-primitives` (issue #982) is adding builtins through the same
files at the same time. Whichever run lands second merges `main` and
regenerates the goldens (`npm run sync-main`); a worker resolves a conflict in
a registration list by keeping both sides' rows. Open PR #912 (`--sandbox`
capability sets) may need to classify these builtins; whichever lands second
adds the names to its table.

Order is smallest first: `fs-replace-bytes`, then `fs-modes-exclusive`, then
`spawn-piped`, which is last because it is the largest, carries the only open
design question (the result shape), and its security record is the longest.

Every stage reads `.claude/orientation.md`, `.claude/selfhost.md`,
`.claude/testing.md` and `.claude/architecture.md` first, and follows
`docs/ARCHITECTURE.md` → "How to add a construct" and the definition of done in
`CLAUDE.md`: the rolling freeze (no `src/` *use* of the new builtins — in
particular `src/compile.ts`'s `chmod`/`mv`/`rm` shell-outs are NOT replaced in
this run), regenerated goldens, the `wasi` and `performance` sections for a
`src/` change, every TypeScript snippet the PR adds to the tests shown with its
exact LLVM IR in the PR body, and the CI shards as the full-suite gate. The PR
title is the changelog line; its squash body is the release-note prose.

## fs-replace-bytes

**Owns:** `runtime/nish.d.ts`, `runtime/nish.h`, `runtime/runtime-os.c`, `runtime/runtime.c`, `runtime/node.mjs`, `runtime/nish.mjs`, `runtime/core/**`, `src/**` (registration only — no `src/` use of the new builtins), `std/README.md`, `tests/cases/**`, `tests/link/**`, `tests/run.js`, `tests/runtime-budgets.js`, `tests/runtime-test.c`, `tests/nish-cmp.js`, `tests/differential/**`, `tests/self/goldens/**`, `docs/LANGUAGE.md`, `docs/AI.md`, `docs/wp35-capabilities.md`, `docs/wp7-runtime.md`, `docs/cookbook/**`, `docs/IR_COOKBOOK.md`, `docs/guide/**`, `docs/security/**`, `llms.txt`, `scalar.config.json`

## fs-modes-exclusive

**Owns:** the same globs as `fs-replace-bytes`. Starts after `fs-replace-bytes` merges (or escalates).

## spawn-piped

**Owns:** the same globs as `fs-modes-exclusive`. Starts after `fs-modes-exclusive` merges (or escalates).
