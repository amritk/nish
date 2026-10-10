# CLI and cache: `nish`, `nish run` and the files and processes they touch

The security audit's record for the CLI stage (issue #363). It says what was
checked, how, what was found, and which test pins each answer. Base is `main`
at `083339e`.

## Scope

| File | Functions |
| --- | --- |
| `src/run-cache.ts` | `runCacheRoot`, `runBinaryName` (new), `fnv1a64Hex`, `fileFingerprint`, `runCacheKey` |
| `src/compile.ts` | `main` (the `run` split and `--link` probe), `makeDirectory`, `makeDirectoryFor`, `planOutputs`, `perModule`, `cCompiler`, `missingToolchain`, `programOnPath`, `packageRootCandidates`, `packageRoot`, `libraryRoot` (new), `runProgram`, `buildIntoCache`, `linkProgram`, `writeSidecars` |
| `src/compilation.ts` | `Compilation.resolveSpecifier` (where `nish/<module>` is read from); the rest of the file was read for file and process access and has none beyond `readFileSyncOrNull` on module paths |

Read but not owned, so any finding in them is recorded as open rather than
fixed: `scripts/build.sh` (how the link's arguments reach `clang`),
`scripts/bootstrap.sh` (where the intermediate stages live), and
`runtime/runtime-os.c` (`nish_put_file`, `nish_mkdir`, `nish_spawn_impl`,
`nish_realpath`: what each builtin actually does to the file system).

## Threat model

The victim runs `nish <file.ts> ...` or `nish run <file.ts>` as themselves.
The attacker is one of:

- **another local user** on a shared machine, who can write to world-writable
  directories (`/tmp`) and to anything the victim's umask leaves open, and can
  read anything the victim's modes leave readable;
- **the author of a checkout** the victim compiles or runs a script from: they
  control every file in the working directory, every file and directory name
  in it, and the source being compiled. Compiling such a checkout must not run
  any of its code; `nish run` must run the program its source describes and
  nothing else;
- **the environment**, only as far as a misconfiguration goes (a relative
  `XDG_CACHE_HOME`, a `CC` that names something else). The attacker does not
  set the victim's environment.

The goals considered: run code as the victim (a planted binary, a planted
`build.sh`, a planted library module, shell text in an argument), start a stale
binary for a changed program, write outside the outputs the command line names,
and read what the victim's cache holds.

## Method

- Read every line of the three owned files that touches a path, a directory,
  an environment variable or a process, and followed each builtin into
  `runtime/runtime-os.c` to learn its real behaviour: `mkdirSync` is
  `mkdir(path, 0777)` (so the umask decides the mode, and an existing directory
  or a symlink to one counts as success), `writeFileSync` is
  `open(O_WRONLY|O_CREAT|O_TRUNC, 0644)` (it follows a symlink and does not
  insist on a new file), `spawnSync` is `posix_spawnp` with no shell (a PATH
  search happens only for an `argv[0]` without a `/`), and `realpathSync` is
  `realpath(3)`.
- Listed every input of the link — `scripts/build.sh`'s options and the
  variables it reads (`CC`, `WASI_SYSROOT`, `WASI_BUILTINS`, `NODE`,
  `NODE_INCLUDE`, `LLVM_PROFILE_FILE`), the runtime files it adds beside
  `runtime.c`, and every `#include "..."` in `runtime/` — and compared that
  list with what `runCacheKey` hashes.
- Read `scripts/build.sh` for quoting: every expansion of a path is quoted,
  and the one `bash -c` in `linkProgram` takes its operands positionally.
- Drove `build/nish` and the base compiler by hand in a scratch directory for
  each hypothesis below, then turned every confirmed one into a check in
  `tests/nish/cli.ts`, which `npm test` builds and runs against the compiler
  it tests (and `npm run test:cli` against `build/nish`). Each check was run
  against the compiler built from the base SHA and failed there, and passes on
  this branch.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| CLI-2 | High | `src/compile.ts:798` `packageRootCandidates`; `src/compilation.ts:765` | A compiler that does not sit in its package (a binary copied to `~/bin`, a broken install) took the **working directory** as its package root. `--link` then ran `./scripts/build.sh` from whatever directory it was started in, and `nish/<module>` compiled `./std/<module>.ts`: compiling someone else's checkout executed their script. Reproduced: a copy of `build/nish` in another directory, run in a directory holding a `scripts/build.sh` that touches a file, touched it and exited 0. Rated High rather than Critical because it needs the compiler outside its package layout. | **Fixed.** `.` is a candidate only when the compiler's own real path is inside the working directory, which is the checkout's own `build/` and `build/selfhost/` stages that the bootstrap relies on. When no candidate has the package, `nish/<module>` is resolved against the root the compiler's path implies (`libraryRoot`), never the working directory, and fails naming it. Tests: `CLI-2: --link does not run the working directory's scripts/build.sh`, `CLI-2: and is refused with the toolchain band, since there is no package`, `CLI-2: nish/<module> is not read from the working directory's std/` |
| CLI-1 | Medium | `src/compile.ts:863` `runProgram` | `nish run key.ts` linked the binary to `<entry>/key`, then wrote the key file over it, then started the key file. The run always failed with exit 3, on every attempt, and on a C library whose `posix_spawnp` falls back to `/bin/sh` on `ENOEXEC` the key text (the program's IR) would be handed to a shell instead. Not verified on such a libc; glibc refuses. | **Fixed.** `runBinaryName` keeps the binary as `key.bin` (and `tmp-*` as `tmp-*.bin`), and the key carries the binary's name, so one entry only ever holds one script's binary. Tests: `CLI-1: a script called key.ts runs, and answers its own status`, `CLI-1: and its own output`, `CLI-1: and runs again from the cache` |
| CLI-3 | Low | `src/run-cache.ts:38` `runCacheRoot` | A relative `XDG_CACHE_HOME` (or `HOME`) resolved against the working directory, so a run started in a checkout looked its binary up in a cache the checkout could supply: a planted `nish/run/<hash>/key` and binary for the checkout's own script ran in place of the source. The XDG base directory rules say a relative value is invalid and is ignored. Needs the victim's environment to be misconfigured, hence Low. | **Fixed.** A value that does not start with `/` is ignored, `XDG_CACHE_HOME` falling back to `HOME` and `HOME` to the refusal. That also makes every path the miss hands to `mv` and `rm` absolute, and both now take `--` besides. Tests: `CLI-3: and keeps nothing under the relative path`, `CLI-3: but under $HOME/.cache, as if it were unset`, `CLI-3: with no absolute HOME either, the run is refused with the toolchain band` |
| CLI-4 | Low | `src/compile.ts:929` `buildIntoCache` | The cache root and every entry were made with `mkdir(0777)` under the umask, commonly `0755`, and each key with `0644`: on a machine whose home directories other users can enter, every user could read each cached program's whole IR, string literals included, and its binary. | **Fixed.** A miss makes the cache root and then runs `chmod 700` on it, and refuses the run when that fails, which it does for a root this user does not own. Every entry is made on a miss, so every entry is behind a private root. Test: `CLI-4: the cache root is private to its owner` |
| CLI-5 | Low | `src/compile.ts:929` `buildIntoCache` | The entry is named by a 64-bit FNV-1a, which is not collision resistant, so two programs' keys can name one entry. A run that moved its binary in and then died before writing its key left the other program's key beside it, and that program's next run was a hit that started the wrong binary. | **Fixed.** The entry's key is emptied before the new binary is moved in; an empty key never equals a real one. Test: `CLI-5: a run killed after its binary is moved in leaves no other program's key beside it` |
| CLI-6 | Medium | `runtime/runtime-os.c:127` `nish_put_file`, used by `src/compile.ts:688` and `writeSidecars` | Every output (`.ll`, sidecars, the cache key) is opened with `O_CREAT|O_TRUNC` and no `O_NOFOLLOW`. A source compiled with no `-o` writes `<module>.ll` beside it, and a symlink at that name redirects the write to whatever file it names. The author of a checkout controls every name in it, so they need no race and no world-writable directory: they ship the source and a symlink at `<module>.ll`, and the victim's plain `nish file.ts` deterministically truncates and overwrites any file the victim can write. Linux's `fs.protected_symlinks` only applies in sticky world-writable directories such as `/tmp`, so it does not help in a checkout or any other shared directory. A destructive write triggered by attacker input, hence Medium; not High, because there is no memory corruption and the attacker does not choose the content written. | **Fixed** in the runtime as RT-4 ([#383](https://github.com/amritk/nish/pull/383), [runtime.md](runtime.md)): `writeFileSync`, `appendFileSync` and `spawnSyncTo` open with `O_NOFOLLOW` and refuse a symbolic link as the last component. Its regression test, RT-4 in `tests/runtime-test.c`, fails on the base `882857d` and passes after. This stage left it open, outside its Owns, needing exactly that primitive. |
| CLI-7 | Low | `src/compile.ts:863` `runProgram` | A **hit** reads the key and starts the binary without checking who owns the cache root, because that check has to stay cheap and the language has no `lstat`. CLI-4's `chmod` covers every root a miss reaches, so the gap is a root that another user created at the victim's cache path (only possible when that path is under a directory they can write) and filled with a key and binary for a program whose IR they can predict. | **Fixed** (#486). Every run, a hit as much as a miss, asks `lstatOwnerModeSync` about the root first (`refuseCacheRoot`, `src/compile.ts:1274`) and refuses one that is not a directory (a symbolic link is not followed), that another user owns, or that its group or every user can write, with exit 3 and `NL0002` (`run: refusing the cache root <root>, which ...`). The miss asks again after its `chmod 700`, since `chmod` succeeds for root on a directory it does not own. One `lstat`, so the hit stays a read and a spawn. Tests: `CLI-7: a cache root its group can write is refused with the toolchain band`, `... every user can write is refused`, `... that is a symbolic link is refused`, `... another user owns is refused` (run as root; a counted skip otherwise, since only root can give a directory away), each with `and the binary in it never ran`; all fail on the base `e1b8d0a`. |
| CLI-8 | Low | `src/run-cache.ts` `fnv1a64Hex` | The entry name is a 64-bit FNV-1a. A hit still compares the full key, so a collision alone only costs a relink, and CLI-5 closes the crash window, but two colliding programs started at the same moment can still interleave `mv` and the key write. Both programs are the victim's own runs. | **Fixed** (#386). `sha256Hex` in `src/run-cache.ts`, FIPS 180-4 written in plain Nish because `src/` reads nothing from `std/`, names every entry and fingerprints every runtime file in the key; `fnv1a64Hex` is gone. Checked against `sha256sum` at every padding boundary (0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 128 bytes, a source file and 20 MB of random bytes). Test: `CLI-8: the entry is named by the SHA-256 of its key` in `tests/nish/cli.ts`, against `std/crypto/sha256`, which fails on the base (`expected "f1e0…97a9", got "a4b2492e51146f75"`) |
| CLI-9 | Low | `src/compile.ts:726` `programOnPath`, `:798` `packageRootCandidates` | The package root is the parent of the compiler's directory, so a compiler kept at `/tmp/x/nish` trusts `/tmp/scripts/build.sh`, which any user can create. And `programOnPath` takes the first *readable* `nish` on `PATH`, where the shell took the first *executable* one, so the two can disagree. | **Fixed** (#486). `programOnPath` takes the first entry whose `nish` is executable and not a directory (`isExecutableSync`), the one the shell ran. Every package-root candidate goes through `considerRoot`, which drops one that is not owned by this user or by root, or that every user can write, and the `--link` refusal names it and why (`refused <dir>, which can be written by every user`). A root its *group* can write is still trusted: whoever can write it can already replace the `bin/` that holds the compiler, so refusing it protects nothing and would refuse every checkout made under a `0002` umask. Tests: `CLI-9: --link does not run scripts/build.sh from a package root every user can write`, `CLI-9: a nish on PATH with no execute bit does not name the package`, `CLI-9: the first executable one does`, which fail on the base `e1b8d0a`, and `CLI-9: a package root only its group can write is still the package`. |
| CLI-10 | Low | `src/compile.ts:960` `buildIntoCache` | The cache root's `mkdir` and its `chmod 700` shared one condition and one message, and `||` short-circuits, so a root that could not be created (`EACCES`, `ENOTDIR`, a regular file at the path) was reported as `cannot make <root> private to this user (chmod 700 failed)`, a chmod that never ran. The user was pointed at the wrong cause. A wrong diagnostic, not a wrong action: the run was still refused. | **Fixed.** The two failures are reported apart: `run: cannot create <root>` for the `mkdir`, the chmod message for the `chmod`, both exit 3 under the toolchain code. Tests: `CLI-10: a cache root that cannot be made is refused with the toolchain band`, `CLI-10: and says it could not be created`, `CLI-10: not that chmod failed` |

## Properties verified

| Property | Pinned by |
| --- | --- |
| `nish run` never keeps a binary under `/tmp`: with neither `HOME` nor `XDG_CACHE_HOME` absolute, it refuses with exit 3 and `NL0002`. | `tests/run.js` "nish run: with neither HOME nor XDG_CACHE_HOME set, an NL0002 refusal under --json, exit 3"; `tests/nish/cli.ts` "CLI-3: with no absolute HOME either, ..." |
| A hit is the stored key being byte-for-byte equal to this run's key, not the entry's name matching: an entry holding another key is relinked, and the binary it held never runs. | `tests/nish/cli.ts` "an entry whose key is not this run's is relinked, not started", "and the binary it held never ran" |
| The key covers every input of the link: the compiler version, the binary's name, the profile, `-g`, `--threads`, `CC`, `scripts/build.sh`, all five runtime C files and `nish.h` (the only header they include), and every module's stem and IR, each IR framed by its length. `scripts/build.sh` reads no `CFLAGS`-style variable that could change a native binary unseen. What is not covered is the version of the compiler `CC` names; upgrading `clang` in place keeps the old binary until the next edit, which is the victim's own build and not a security question. | `tests/run.js` "nish run: an edited script is rebuilt, ...", "nish run: each program has its own entry" |
| No argument reaches a shell as text. Every spawn is an argv through `posix_spawnp`; the one `bash -c` takes its operands as positional parameters; `scripts/build.sh` quotes every expansion. | `tests/nish/cli.ts` "a --link path full of shell syntax links", "and none of it is run" |
| The binary a run starts is named by a path with a `/`, so `posix_spawnp` never searches `PATH` for it. A hit spawns nothing else. | `tests/run.js` "nish run: a second run of the same program is a hit -- it runs with no C compiler and no shell on PATH" |
| No path the compiler builds can be read as an option: per-module IR is always below a directory (`-o <dir>/`, `<exe>.modules/`), the cache paths are absolute, and `mv` and `rm` take `--`. | code review of `planOutputs` and `buildIntoCache`; CLI-3's tests |
| A failed link leaves no key and no scratch directory, so the next run links again rather than starting a binary that is not there. The scratch directory is inside the entry, so concurrent misses never share one. | `tests/run.js` "nish run: a failed link is the link's report, exit 3, and leaves no key and no scratch directory behind" |
| A script's name cannot collide with the entry's own files. | `tests/nish/cli.ts` CLI-1's checks |
| The cache root is private to its owner after any miss. | `tests/nish/cli.ts` "CLI-4: the cache root is private to its owner" |

## Status after the runtime stage

The runtime stage ([`runtime.md`](runtime.md)) merged after this record and
changed what is open. The table keeps this stage's findings as they stood;
this is what is true now.

- **CLI-6 is fixed in the runtime** (RT-4): `writeFileSync`, `appendFileSync`
  and `spawnSyncTo`'s two paths open with `O_NOFOLLOW` and refuse a symbolic
  link as the last component. The compiler is built by the last release, so
  the fix reached `nish` itself with the next release, 0.16.0; 0.15.0 and
  earlier still follow the link.
- **CLI-7 and CLI-9 have their primitives** (RT-9): `nish_lstat_owner_mode`,
  `nish_euid` and `nish_is_executable` in `runtime/runtime-host.c`. `src/` may
  call them only once a release declares them, so both stay open until the
  release after the runtime stage, and then need the change in
  `src/compile.ts` that uses them.
- CLI-8 is unchanged. *Since fixed by #425 (the next section).*

## Status after the owner builtins (#386, phase 1)

- **The RT-9 primitives are builtins**: `lstatOwnerModeSync(path): i64`,
  `geteuid(): i64` and `isExecutableSync(path): boolean`
  ([LANGUAGE.md](../LANGUAGE.md#who-owns-a-path-lstatownermodesync-geteuid-and-isexecutablesync)).
  `src/` may call them once a release ships them (the rolling freeze), so
  **CLI-7 and CLI-9 stay open** for the release after this one: a hit that
  refuses a cache root it does not own or that is group- or world-writable,
  and a `programOnPath` that takes the first *executable* `nish`.
- **CLI-8 is fixed**: the entry is named by a SHA-256 of its key (the row
  above).
- **`scripts/bootstrap.sh` no longer needs the working-directory fallback.**
  Its stages live in `<work>/bin/`, and `<work>` holds `scripts`, `runtime`
  and `std` as symbolic links to the checkout by absolute path, so each stage
  finds the checkout through its own path. On the base, a `--work` outside the
  checkout failed at stage2 with `--link: cannot find scripts/build.sh`; it
  now builds and verifies. The `.` candidate in `packageRootCandidates` is
  still there, and can go with CLI-9's change.

## Status after the owner checks (#486)

- **CLI-7 and CLI-9 are fixed** (their rows above), with the builtins the
  0.18.0 seed ships, so `src/` could call them under the rolling freeze.
- The ownership rule differs on purpose between the two. The cache root is
  this user's alone and is refused when its group can write it, because a run
  never makes it so: such a root predates CLI-4 or was changed by someone
  else, and `rm -rf` of it costs one relink. The package root may be root's,
  as every system install is, and only every-user write is refused.
- The `.` candidate in `packageRootCandidates` is still there, now under the
  same check; removing it is left to a change of its own.

## Doc corrections for the security-policy stage

- `docs/INSTALL.md`, the `nish run` section: "It needs `HOME` or
  `XDG_CACHE_HOME` set" should say *set to an absolute path* (a relative one is
  now ignored), and should say that the cache root is made `0700` on the first
  run that builds into it.
- `docs/INSTALL.md` and `.claude/selfhost.md`: a compiler outside its package no
  longer falls back to the working directory for `scripts/build.sh` and `std/`
  unless the compiler itself is inside that directory. An install has to keep
  `bin/nish` beside `scripts/`, `runtime/` and `std/`, which every documented
  install already does; CLI-9's advice (a parent directory only you can write)
  belongs beside it.
- The supply-chain stage owns `scripts/bootstrap.sh`: its intermediate stage at
  `build/selfhost/stage` still finds the checkout only through the narrowed
  `.` fallback. Building that stage one level below the checkout's root, or
  passing the root explicitly, would let the fallback go entirely. (Done in #386 phase 1: see "Status after the owner builtins".)
