# WP37: The OS sandbox — holding a running process to its capabilities

**Status: stage 1 built** — `--sandbox` and `--sandbox=best-effort`, the
wrapper calls and `runtime/runtime-sandbox.c`, recorded in
[`security/sandbox.md`](security/sandbox.md); the directory scopes and open
question 13 are stage 2. Every `file:line` anchor, figure
and code number in this note is true of `main` at `c8a00d6`; a later edit that
moves an anchor names the commit its own anchors are at.

WP35 ([wp35-capabilities.md](wp35-capabilities.md)) works out which of eleven
capabilities every function can reach. WP36
([wp36-capability-policy.md](wp36-capability-policy.md)) refuses at compile
time a program that reaches one its policy does not grant. Neither holds the
running process to anything: a `declare function` that calls `fork` or
`socket` is `ffi`, and once `ffi` is granted the binary can do whatever libc
can. This package adds `--sandbox`: the native `main` wrapper confines the
process with Landlock and seccomp, before the user's `main` runs, to the set of
capabilities the compiler computed for `main`. That is also where the
`fs.read=<dir>` scopes WP36 refuses are accepted, because the kernel then
enforces them.

## Contents

1. [Why](#1-why)
2. [The flags](#2-the-flags)
3. [The wrapper](#3-the-wrapper)
4. [The mapping](#4-the-mapping)
5. [The kernel version floor](#5-the-kernel-version-floor)
6. [The fallbacks](#6-the-fallbacks)
7. [Platforms](#7-platforms)
8. [The tests](#8-the-tests)
9. [What ships with it](#9-what-ships-with-it)
10. [Out of scope](#10-out-of-scope)
11. [Open questions](#11-open-questions)

## 1. Why

The compiler already knows, for every function, the capabilities it can reach:
`propagateCapabilities` (`src/attributes.ts`) fills each function's
`FunctionFacts.caps`, an eleven-bit mask over the bits `src/capabilities.ts:34-51`
defines (`clock` 0, `entropy` 1, `env` 2, `exit` 3, `ffi` 4, `fs.read` 5,
`fs.write` 6, `net` 7, `process.spawn` 8, `signal` 9, `unsafe` 10). That
answer is a proof about the Nish code. It is not a proof about what an `ffi`
callee does, and it is not a proof about the binary once someone else's code
is linked in. A sandbox turns the computed set into something the kernel
holds the process to.

**The sandbox confines to `main`'s computed set, not to the policy.** Three
reasons:

- The computed set is never wider than the policy, because WP36 refuses a
  program whose host-visible functions reach more than the policy grants
  (NL2459). Confining to the policy would grant rights the compiler already
  knows the program's Nish code cannot use. That is not true of an `ffi`
  callee, which the next paragraph states.
- It needs no policy. `nish --link --sandbox app.ts` with no `--allow`, no
  `--deny` and no manifest field still confines the binary to what `main`
  reaches, so a sandbox costs a user one flag.
- `main` is the only entry a native process has. The wrapper calls it and
  nothing else, so its mask covers every Nish function the process can run.
  A library's other exports reach the process only through `main`.

**The computed set says nothing about what C code needs.** For a `declare
function` callee the compiler computes the `ffi` bit and no other, and §4
maps `ffi` to no right. A program whose Nish code reaches only `ffi`, but
whose C library opens a socket or writes a file (libcurl, sqlite), therefore
has no `net`, `fs.*` or `process.spawn` in its mask: it is killed at
`socket()` or refused at `open`, and `--allow net` cannot widen the mask,
because the wrapper confines to the computed set. As proposed, `--sandbox`
fits an `ffi` program only when its C code needs nothing the Nish code does
not also reach. What `--allow` means for such a program under `--sandbox` is
the owner's call, open question 13.

The mask is read where `refuseCapabilities` (`src/compilation.ts:1415`)
already reads it: from `this.analyze()`'s facts for the signature
`this.entry().checker.program.entryMain` names (`src/compilation.ts:1434`).

## 2. The flags

Two spellings, matched as the first `=` form, the way `--allow`'s value is not
(`--allow` takes the next argument, `src/compile.ts:621`):

- **`--sandbox`**: strict. The binary refuses to run unless every confinement
  the mapping (§4) calls for is applied.
- **`--sandbox=best-effort`**: the binary applies what the running kernel
  supports and prints one line naming what it could not (§6).

Any other `--sandbox=` value is a usage error, exit 2, naming the two.

| Where | `--sandbox` |
|---|---|
| `nish --link app.ts` | accepted |
| `nish run app.ts` | accepted, before the file; it joins the run cache's key (§3) |
| `nish app.ts` (IR only), alone or with a flag that writes its file beside the IR (`--emit-header`, `--emit-dts`, `--emit-napi`, `--emit-panics`, `--emit-arena`, `--emit-capabilities`), and `--capabilities` | accepted: the `.ll` carries the call, and a user who links it with their own `clang` gets the confinement |
| `--fix`, `--emit-ast`, `--emit-checked` | refused, exit 2: none emits a main wrapper to put the call in; `--emit-checked` writes its dump and returns before any IR is emitted (`src/compile.ts:998-1001`) |
| an entry with no `main` | refused by the existing check (`src/compile.ts:958`): `--link` and `nish run` already need `main`; on the IR-only route it is a usage error, exit 2, because there is no wrapper to put the call in |
| `--target x86_64-apple-darwin`, `aarch64-apple-darwin`, or a darwin host without `--target` | refused with the next free NL3xxx (NL3038 at `c8a00d6`; the number is taken when the implementation lands) |
| `--target wasm32-unknown-unknown`, `wasm32-wasi` | accepted, and no call is emitted: the host already holds a wasm module to its imports (§7) |

**`fs.read=<dir>` is accepted only with `--sandbox`** (`fs.write=<dir>` is
open question 1).
Today `capabilityListMask` (`src/compile.ts:390-430`) refuses any scope with
"scopes a capability to a directory, which the compiler cannot prove and
nothing enforces" (`src/compile.ts:414`). With `--sandbox` on the same command
line, `--allow fs.read=/srv/data` is accepted: the compiler still sees the
capability whole (the policy check is unchanged, `fs.read` is granted), and the
directory is handed to the wrapper as a Landlock rule. Without `--sandbox` the
refusal stays word for word. The directory is resolved to an absolute,
symlink-free path at compile time and must exist then: a scope to a directory
that is not there would be a rule Landlock cannot open. Whether a manifest may
carry a scope is open question 1.

The scope check therefore moves after argv parsing. Today `capabilityListMask`
runs on each `--allow` as it is read (`src/compile.ts:628`), before a later
`--sandbox` has been seen; the implementation keeps each scope as written and
decides once the whole command line is read, so `--allow fs.read=/srv/data
--sandbox` and `--sandbox --allow fs.read=/srv/data` are the same command.

## 3. The wrapper

`emitEntryWrapper` (`src/emit.ts:756`) builds the native `@main`. With
`--sandbox` it emits, beside `@main`, one internal function whose address
sits in the executable's `.preinit_array`, and gives `@main` one new first
instruction, a call that refuses to run if that function never ran. The C
runtime calls that function before any constructor runs, so a constructor in
a linked C object or a shared library is already confined (below, "What runs
before the call"). The wrapper is `tests/cases/argv_echo.ll:211-217` as it is
today (optimized, so the return carries `noundef`, `src/emit.ts:766-769`),
apart from its first call; that call and the lines above `@main` are the
proposal. The `nish_argv_init` call is there because `argv_echo` reads its
arguments: the wrapper emits it only when `this.program.usesArgv`
(`src/emit.ts:780`), with or without `--sandbox`:

```llvm
@.sandbox.read = private unnamed_addr constant [11 x i8] c"/srv/data\00\00"
@.sandbox.preinit = internal constant void ()* @.sandbox.apply, section ".preinit_array", align 8
@llvm.used = appending global [1 x i8*] [i8* bitcast (void ()** @.sandbox.preinit to i8*)], section "llvm.metadata"

define internal void @.sandbox.apply() {
entry:
  call void @nish_sandbox(i32 33, i32 1, i8* getelementptr inbounds ([11 x i8], [11 x i8]* @.sandbox.read, i64 0, i64 0), i8* null)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_sandbox_check()
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

declare void @nish_sandbox(i32, i32, i8*, i8*)
declare void @nish_sandbox_check()
```

`@llvm.used` keeps the otherwise unreferenced entry through `opt`, and
`.preinit_array` is kept by the linker's default script, so it survives
`--gc-sections`. Measured at `c8a00d6` with Ubuntu clang 18.1.3, glibc,
x86-64: these three globals, `llvm-as`-clean, linked with `-O2
-Wl,--gc-sections` beside a C object holding a `constructor(101)` and against
a shared library with a constructor, ran the preinit function first, then
the library's constructor, the object's, and `main`. They ran in the same
order with the library given in `LD_PRELOAD`, and with `-static`. A
`.preinit_array` entry is refused in a shared object, so IR built with
`--sandbox` and linked by hand into a `.so` fails at link time rather than
running unconfined.

**A C library that skips `.preinit_array` fails closed.** That measurement is
glibc's. musl's start-up, as its source reads, runs `_init` and
`.init_array` but not `.preinit_array`, and `docs/INSTALL.md:218-233`
documents linking emitted IR on a musl host. There the entry would never
run. `nish_sandbox` therefore sets a flag in the runtime unit as its last
step, and `nish_sandbox_check` returns when the flag is set and otherwise
prints `nish: --sandbox: the C library did not run .preinit_array, so the
program was not confined` and calls `_exit(126)`. A program built with
`--sandbox` and linked against such a libc refuses to run. Its constructors
have already run, unconfined, by then, so §7 states such a libc as
unsupported and §9 names the window.

The operands, in order:

1. **`i32 <caps>`**: `main`'s computed mask, a constant. `33` above is
   `fs.read` (bit 5) and `clock` (bit 0).
2. **`i32 <mode>`**: `1` for `--sandbox`, `2` for `--sandbox=best-effort`.
3. **`i8* <read dirs>`**: a private constant of NUL-terminated absolute paths
   ending in an empty string, or `null` when `fs.read` is granted whole.
4. **`i8* <write dirs>`**: the same for `fs.write`.

The runtime symbol, the operand order and the constant's name
`@.sandbox.read` are this note's proposal; the golden `.ll` the implementation
adds pins whatever lands. `@nish_main` is the user's `main`, renamed as
`src/declarations.ts:300` renames it today.

**No `tests/cases/*.ll` golden moves without the flag.** The preinit entry,
its `@llvm.used` slot and the function holding the call are emitted only when
`--sandbox` is given, the declaration enters the module through `useRuntime`
only then, and no existing test passes `--sandbox`. The
implementation PR shows this with a full `node tests/run.js` run whose `.ll`
goldens are byte-identical. The generated goldens are another matter: the
implementation edits `src/compile.ts`, `src/emit.ts`, `src/runtime.ts` and
`src/run-cache.ts`, so `tests/self/goldens/checked.txt` and `checked-self.txt`
move whether or not a case is added, and are regenerated (§9).

**The runtime half is a new unit, `runtime/runtime-sandbox.c`**, always
compiled and paired in `scripts/build.sh`'s `halves` (`:152`) and
`src/run-cache.ts`'s `runtimeUnits()` (`:74-83`) in one commit, as CLAUDE.md
requires. On Linux it holds `nish_sandbox`; on every other platform the same
symbol prints `nish: --sandbox: this platform has no sandbox` and calls
`_exit(126)`, so a target-neutral `.ll` linked on macOS fails closed rather
than running unconfined.

**The freestanding `--profile wasm` route never links the unit** (CLAUDE.md's
rule on wasm32 lowerings). That branch links with `-nostdlib` and without
`runtime.c` (`scripts/build.sh:394-397`), and `halves` are added only beside
`runtime.c` (`:152-163`), so IR built for the host with `--sandbox` and linked
there fails closed at link time, on an undefined `nish_sandbox`, and a stub
using `_exit` could not link under `-nostdlib` anyway. The implementation
makes that refusal readable rather than a linker error: the wasm branch greps
its `.ll` inputs for `@nish_sandbox(` and exits 2 with `--sandbox: a wasm
module has no sandbox; compile with --target wasm32`, the way
`runtime-aes.c`'s grep for `@nish_aes_hw(` decides that unit (`:375-391`).
A binary that does not call it loses the unit's `.text` to `--gc-sections`
(`scripts/build.sh:198`), which the speed and size profiles already pass with
`-ffunction-sections`.

**The cache keys need nothing new.** `runCacheKey` hashes every module's IR
(`src/run-cache.ts:300-303`), and the call, its mask and its directory
constants sit in that IR, so `nish run --sandbox` and `nish run` hit different
entries already. `runtimeCacheKey` (`src/run-cache.ts:319`) is unchanged,
because the runtime is built the same way with or without the flag. The
alternative, a `-DNISH_SANDBOX` define as #451's draft had, is open question 9.

The declaration goes into `src/runtime.ts`'s table and its prototype into
`runtime/nish.h`, which moves `docs/IR_COOKBOOK.md`'s runtime prelude;
`docs/cookbook/regen.sh` regenerates it in the same commit.

**What runs before the call.** The preinit function runs after the dynamic
loader has mapped and relocated every object, and before any `.init_array`
entry, `DT_INIT` function or C++ static initialiser, in the executable, in a
linked `ffi` object, or in a shared library, `LD_PRELOAD`'s included. Four
things run earlier, and none of them is confined:

- the dynamic loader itself, and an `LD_AUDIT` library's hooks;
- an `LD_PRELOAD` library's symbol interposition, which needs no constructor:
  a preloaded `prctl` or `syscall` can make the sandbox a no-op;
- libc's own start-up before it walks `.preinit_array`;
- an IFUNC resolver, which runs during relocation, in a linked C object or
  in a shared library the binary needs (`DT_NEEDED`). Measured as above: a
  resolver in a linked C object printed before the preinit function, linked
  dynamically and with `-static`; a needed library's resolvers run in the
  dynamic loader, before it too.

The first three are chosen by whoever launches the binary, whom the threat
model trusts (§9). The fourth is code in the program, so it is a limit on
what `--sandbox` holds, named in §9 and open question 11. A second
`.preinit_array` entry in an `ffi` object would run in link order. The
implementation passes the main module's object first on the link line, so
the sandbox's entry is first, and §8 pins that.

**What `nish_sandbox` does**, in this order, before any constructor:

1. Prime what confinement would break: the pool's hardware ceiling, which
   reads files (§4, `--threads`). This step reads no environment variable:
   on dynamic glibc `getenv` answers `NULL` from a `.preinit_array` entry,
   because libc has not yet set `environ` (measured on glibc 2.39, where a
   static link answered).
2. `prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)`. Both Landlock and seccomp need it
   for an unprivileged process, and after it no `execve` gains a capability
   or an identity: the kernel caps a new program's permitted set at the
   caller's.
3. Drop every capability the process holds. With `CAP_SETPCAP` effective,
   `PR_CAPBSET_DROP` empties the bounding set first.
   `PR_CAP_AMBIENT_CLEAR_ALL` empties the ambient set, and `capset` empties
   the effective, permitted and inheritable sets, which needs no privilege.
   Each is then read back: the effective, permitted and inheritable sets by
   `capget`, the ambient set by `PR_CAP_AMBIENT_IS_SET` for each capability,
   and the bounding set by `PR_CAPBSET_READ`, required empty only when
   `CAP_SETPCAP` was held. Without it the bounding set cannot be dropped,
   and it need not be: with `NO_NEW_PRIVS` and an empty permitted set,
   nothing the bounding set allows can be gained. Any checked set left
   non-empty is a failure in both modes, exit 126. A process started as root, with file capabilities,
   or with a container's default set therefore runs confined and
   unprivileged. After step 2, a program it `exec`s gains nothing either.
   Without this step, an `ffi` callee holding `CAP_SYS_MODULE`,
   `CAP_DAC_READ_SEARCH` or `CAP_SYS_ADMIN` could call `finit_module`,
   `open_by_handle_at` (a way past Landlock's path rules) or `bpf`, none of
   which §4's rows name. With the sets empty, the kernel refuses each of
   them `EPERM`. The uid is not changed: §9 says what a uid-0 process
   keeps.
4. Build a Landlock ruleset from the mask and the directory lists, masked down
   to the ABI the kernel reports (§6), and apply it with
   `landlock_restrict_self`.
5. Load the seccomp filter (§4) with `seccomp(SECCOMP_SET_MODE_FILTER,
   SECCOMP_FILTER_FLAG_TSYNC, ...)`; no other thread exists yet, so `TSYNC`
   only states the intent.
6. Set the flag `nish_sandbox_check` reads, and return. A strict-mode failure at any step prints `nish: --sandbox: <what>
   (<errno name>)` on stderr and calls `_exit(126)` (open question 2).

## 4. The mapping

Each capability's bit, when it is **absent** from `main`'s mask, becomes a
Landlock right withheld, a seccomp rule, or nothing, with the reason.

| Capability | Confined by | When absent |
|---|---|---|
| `fs.read` | Landlock | `READ_FILE` and `READ_DIR` withheld everywhere; with `fs.read=<dir>`, granted beneath each directory only |
| `fs.write` | Landlock | `WRITE_FILE`, `MAKE_REG`, `MAKE_DIR`, `REMOVE_FILE`, `REMOVE_DIR`, `MAKE_SYM`, `MAKE_*` for special files, `REFER` (ABI 2) and `TRUNCATE` (ABI 3) withheld; with `fs.write=<dir>` (open question 1), granted beneath it. The metadata writes Landlock has no right for fail `EPERM` in seccomp (below) |
| `process.spawn` | seccomp and Landlock | `EXECUTE` withheld everywhere (below, "`process.spawn` widens Landlock"); `execve` and `execveat` kill; `fork`, `vfork` (x86-64 only: AArch64 has neither number) and `clone` without `CLONE_THREAD` kill; `clone3` returns `ENOSYS` |
| `net` | seccomp | `socket`, `socketpair`, `connect`, `bind`, `listen`, `accept`, `accept4` kill; so do `io_uring_setup`, `io_uring_enter` and `io_uring_register`, since io_uring opens and connects sockets without those syscalls (below) |
| `ffi` | nothing | it is the reason the sandbox exists: what an `ffi` callee does is held by the rows above, not by its own bit. So an `ffi` callee gets only the rights the Nish code's own bits grant (§1, open question 13) |
| `unsafe` | nothing | it changes what a Nish expression compiles to, not what the process asks the kernel for |
| `clock` | nothing | `clock_gettime` is a vDSO call, and `statMtimeSync`'s `stat` is not a right Landlock has |
| `entropy` | nothing | `getrandom` (`runtime/runtime-host.c:83`), not a file open, so no Landlock right covers it, and denying a syscall glibc may itself use for its own needs costs more than it buys |
| `env` | nothing | the environment is in the process's own memory before `main` runs; `geteuid` reveals nothing a sandbox can withhold |
| `exit` | nothing | the process may always end |
| `signal` | nothing | `signalFd` and `readSignal` install handlers for the process's own signals; sending a signal to another process is not a Nish builtin, and Landlock ABI 6's signal scoping is open question 8 |

Three rules hold under `--sandbox` whatever the mask says:

| Rule | Why |
|---|---|
| on x86-64, any syscall number with bit 30 (`__X32_SYSCALL_BIT`, `0x40000000`) set kills | an x32 call reports `AUDIT_ARCH_X86_64` in `seccomp_data.arch` and carries `nr \| 0x40000000`, so it passes the arch check and matches none of the 64-bit numbers above: `socket` called as `0x40000029` would step around the `net` row. The filter runs before the kernel dispatches the call, so the kill holds whether or not the kernel was built with `CONFIG_X86_X32_ABI` |
| `ptrace`, `process_vm_readv`, `process_vm_writev` and `pidfd_getfd` kill | each reaches into another process of the same user: a write into an unconfined parent's memory, or a descriptor taken from it, is a full escape. Landlock's ptrace hook already refuses a confined process tracing an unconfined one, but best-effort without Landlock has no such hook, and the runtime calls none of the four |
| `io_uring_setup`, `io_uring_enter` and `io_uring_register` kill when `net` or `process.spawn` is absent | io_uring's operations do not pass through seccomp: `IORING_OP_SOCKET` (5.19), `IORING_OP_CONNECT` and `IORING_OP_ACCEPT` (5.5), and `IORING_OP_BIND` and `IORING_OP_LISTEN` (6.11) would step around the `net` row. No io_uring operation executes a program as of 6.18, but killing it whenever either bit is absent costs nothing (the runtime makes no io_uring call, `grep -rn io_uring runtime/` at `c8a00d6`) and keeps the `process.spawn` row from depending on a future kernel's opcode list. Its file opens still pass Landlock's hooks |

**Every way in, probed.** Each kill row is a denylist of one route, so each was
checked for its siblings. `net`: `socketcall(2)` multiplexes the socket calls,
but only on the 32-bit entries, which the arch check kills; io_uring is the
row above; a socket inherited or received over `SCM_RIGHTS` is an open
descriptor, which §9's threat model leaves the adversary. `process.spawn`: `execveat` with
`AT_EMPTY_PATH` is in the row; `clone3` answers `ENOSYS`; io_uring is above;
`/proc/<pid>/mem` writes go through the same ptrace access check Landlock
hooks, so they are covered where `ptrace` is, and §9 names them for
best-effort without Landlock. The filesystem: below.

**Rights are withheld, never handled-and-denied piecemeal.** The ruleset
handles every filesystem right the running ABI knows (§6), then adds a
`path_beneath` rule granting back exactly what the mask grants: beneath `/` for
a capability granted whole, beneath each directory for a scoped one.
From ABI 5, `IOCTL_DEV` is one of the handled rights, and it is granted back
beneath `/` only when `process.spawn` is granted. A device's `ioctl` can act
like a spawn: `TIOCSTI` on a terminal pushes keystrokes that the user's shell
runs after the process exits, and an unprivileged process may do that to its
own controlling terminal wherever `dev.tty.legacy_tiocsti` is 1, still the
default on Debian- and Ubuntu-style kernels. A program with `fs.read` but
without `process.spawn` can therefore reopen `/dev/tty` but cannot `ioctl`
it, beyond the few requests Landlock always allows (`FIOCLEX`, `FIONBIO` and
their kind); a terminal program that needs more asks for `process.spawn`, and
the guide page says so. Two routes stay, and §9 names both: a terminal
already open when the ruleset applies, fd 0 included, is not checked, and
below ABI 5 the right does not exist, so a reopened `/dev/tty` takes every
request (open question 12). `dev.tty.legacy_tiocsti=0` (6.2) closes
`TIOCSTI` on both.

**What Landlock leaves alone.** `stat`, `lstat`, `readlink` and `access` are not
Landlock rights, so `isDirectorySync` (`runtime/runtime-os.c:204`),
`statMtimeSync` (`nish_stat_mtime`, `runtime/runtime-host.c:102`), `lstatOwnerModeSync` (`nish_lstat_owner_mode`, `:126`),
`isExecutableSync`'s `access(X_OK)` (`:135`) and `realpathSync`'s walk keep
working without `fs.read`. All of them but `statMtimeSync` (`clock`) are
`fs.read` in WP35's table, so a program that uses them has the bit anyway; the
point is only that the sandbox does not break them. A descriptor already open when the ruleset
applies, stdin, stdout and stderr included, keeps working. The other reads
Landlock has no right for leave the same way, and §9 names them among
what the adversary keeps: `statx`, `getxattr` and `listxattr` with their `l` and
`f` forms, an `O_PATH` open, `chdir`, and `inotify_add_watch` and
`fanotify_mark` on a path. They reveal a file's metadata or its changes, not
its contents.

**Metadata writes Landlock has no right for.** Landlock has no right for
changing a file's mode, owner, times or extended attributes, so a program
without `fs.write` could otherwise `chmod` any file the user owns. When
`fs.write` is absent the filter answers these `EPERM`, not a kill, because
seccomp cannot see a path and a failed call is what Landlock's refusals look
like to the program:

| Family | Syscalls |
|---|---|
| mode | `chmod`, `fchmod`, `fchmodat`, `fchmodat2` (6.6) |
| owner | `chown`, `fchown`, `lchown`, `fchownat` |
| times | `utime`, `utimes`, `futimesat`, `utimensat` |
| set an attribute | `setxattr`, `lsetxattr`, `fsetxattr`, `setxattrat` (6.13) |
| remove an attribute | `removexattr`, `lremovexattr`, `fremovexattr`, `removexattrat` (6.13) |

AArch64 has only the `*at` forms and the `f` forms; the filter lists the
numbers each architecture has. A number newer than the running kernel
matches nothing and costs nothing. With `fs.write=<dir>` the calls are
refused everywhere, inside the directory too, because seccomp cannot tell
where the path points (open question 1). `ioctl` with `FS_IOC_SETFLAGS` or
`FS_IOC_FSSETXATTR` on a descriptor opened read-only can set a file's
append-only or immutable flag where the user may; filtering `ioctl` by
request number is argument-level checking §10 leaves out, so §9 names it
among what the adversary keeps. The runtime makes none of these calls (`grep -rn
'chmod\|chown\|utime\|xattr' runtime/` at `c8a00d6`).

**`process.spawn` widens Landlock.** A spawned program needs to execute and
read its own binary and libraries, wherever `PATH` finds them. With the bit
present, `EXECUTE` and `READ_FILE` are granted beneath `/` whatever `fs.read`
says, so a program that spawns can read every file the user can, through its
child or directly. The child inherits the domain and the filter, and is held
to them. This widening is open question 5. `spawnSyncTo` opens its redirect
file in the child (`runtime/runtime-os.c:254`), under the inherited domain, so
a redirect without `fs.write` to that path fails in the child; the
implementation states that in the guide page and pins it with a test.

**`--threads` and `clone`.** `pthread_create` (`runtime/runtime-parallel.c:370`,
`:456`) calls `clone` with `CLONE_THREAD`, which the filter allows.
`posix_spawnp`, which `nish_spawn_impl` uses (`runtime/runtime-os.c:221-263`),
calls `clone` with `CLONE_VM | CLONE_VFORK` and no `CLONE_THREAD`, which the
filter kills when `process.spawn` is absent. `clone3` carries its flags in a
struct seccomp cannot read, so the filter answers it `ENOSYS`, and glibc 2.34
and later fall back to `clone`, where the flag is visible. A threaded program
without `process.spawn` therefore runs its pool and cannot spawn.

**`--threads` and the pool's size.** `nish_cgroup_cpus`
(`runtime/runtime-parallel.c:85-140`, under `NISH_PAR_REAL` and `__linux__`)
opens `/proc/self/cgroup` and the `cpu.max` files beneath `/sys/fs/cgroup` to
size the pool. Under Landlock without `fs.read` those opens fail with `EACCES`,
and `nish_cpu_count` falls back to `sysconf` and the affinity mask: a
container limited by cgroup quota would get more threads than its share.
Step 1 of §3 therefore splits `nish_cpu_count` (`runtime/runtime-parallel.c:143-168`)
in two. A new `nish_cpu_prime`, called from step 1, computes the
environment-free ceiling, `sysconf`, the affinity mask and
`nish_cgroup_cpus`, before the ruleset applies, and caches it. It is called
whatever the mask says, and it is empty in a runtime built without
`NISH_THREADS`, so the wrapper needs no operand saying whether the program
has threads. `nish_cpu_count` keeps its cache, `nish_cpu_cached`, and on its
first call, from `main` or later, takes the primed ceiling in place of the
three reads and applies `NISH_NUM_THREADS` with `getenv`, which by then sees
the environment. With `NISH_NUM_THREADS` set, the count is the smaller of
the two, as it is unsandboxed (open question 6). The variable only lowers
the count, so it is not a way to weaken anything.

**The exit status of a killed run.** The filter's action is
`SECCOMP_RET_KILL_PROCESS`, so the whole process, every thread, dies of
`SIGSYS`, signal 31 on x86-64 and AArch64 Linux. `nish run` reports
`128 + 31 = 159` (the `128 + n` rule its doc comment states,
`src/compile.ts:1400`), and so does `spawnSync` from a parent Nish program
(`runtime/runtime-os.c:221-263`). A shell reports 159 as well. A Landlock
refusal is not a kill: the call fails with `EACCES`, and the program's own
error path runs: `readFileSync` prints `nish: cannot read <path>` and exits 1
(`nish_io_fail`, `runtime/runtime-os.c:75-79`).

## 5. The kernel version floor

| Feature | Linux release |
|---|---|
| `PR_SET_NO_NEW_PRIVS` | 3.5 |
| seccomp-bpf (`SECCOMP_MODE_FILTER`) | 3.5 |
| `seccomp(2)` and `SECCOMP_FILTER_FLAG_TSYNC` | 3.17 |
| `SECCOMP_RET_KILL_PROCESS` and `SECCOMP_GET_ACTION_AVAIL` | 4.14 |
| Landlock ABI 1: the filesystem rights | 5.13 |
| Landlock ABI 2: `REFER` (rename and link across directories) | 5.19 |
| Landlock ABI 3: `TRUNCATE` | 6.2 |
| Landlock ABI 4: TCP `bind` and `connect` rules | 6.7 |
| Landlock ABI 5: `IOCTL_DEV` | 6.10 |
| Landlock ABI 6: scoping of abstract unix sockets and signals | 6.12 |
| Landlock ABI 7: audit logging flags | 6.15 |

**The floor for strict `--sandbox` is 6.2 (ABI 3) for a program without
`fs.write` or with `fs.write=<dir>`, and 5.13 (ABI 1) for one granted
`fs.write` whole**, with Landlock enabled; 4.14 for
the seccomp half alone. Below ABI 2 `REFER` does not exist and the kernel
refuses every rename or link across directories, which is stricter, not
weaker, and Nish has no builtin that renames. A kernel with Landlock built but not in its `lsm=`
list answers `EOPNOTSUPP`, which the wrapper treats as "no Landlock".

| Machine | Kernel | Landlock | `KILL_PROCESS` | How known |
|---|---|---|---|---|
| this development container | 6.18.44 | ABI 7 | available | measured at `c8a00d6`: a probe calling `landlock_create_ruleset(NULL, 0, LANDLOCK_CREATE_RULESET_VERSION)` and `seccomp(SECCOMP_GET_ACTION_AVAIL, ...)`; `/proc/self/status` showed `Seccomp: 0` |
| CI's `ubuntu-latest` | unverified | unverified | unverified | the runner image does not pin a kernel; the implementation's first CI step prints `uname -r` and the probe's answer, and this row is rewritten from that log |
| CI's `ubuntu-24.04-arm` | unverified | unverified | unverified | as above |

## 6. The fallbacks

The wrapper asks the kernel for its Landlock ABI once and acts on the answer.

| Situation | `--sandbox` | `--sandbox=best-effort` |
|---|---|---|
| No Landlock (`ENOSYS` or `EOPNOTSUPP`, or `EPERM` from a container runtime's own seccomp profile denying the call) | refuses to run: `nish: --sandbox: this kernel has no Landlock; build with --sandbox=best-effort to run with seccomp alone`, exit 126 | prints `nish: --sandbox: no Landlock, files are not confined` once on stderr and continues with seccomp alone |
| Older ABI than the rights the mask withholds | refuses to run when a right §4 withholds is unknown to the ABI: below ABI 3, `truncate(2)` on a file the user owns is not a Landlock right, so a program without `fs.write` needs ABI 3, and so does one granted `fs.write=<dir>`, whose files outside the directory `truncate` would reach | handles the rights the ABI knows, and names the ones it could not withhold, once |
| ABI 1 to 4, no `IOCTL_DEV` | runs, the one exception to the row above: §4 and §9 state what a reopened terminal keeps (open question 12) | runs, and names `IOCTL_DEV` |
| A scope directory missing at run time (`open(O_PATH)` for its rule answers `ENOENT`) | refuses to run, naming the directory, exit 126 | leaves the rule out, which only narrows what is granted, and names the directory once |
| No seccomp, or no `KILL_PROCESS` | refuses to run | refuses to run |

**Missing seccomp is fatal in both modes.** Best-effort exists for kernels
older than Landlock; a kernel with no seccomp filter at all, or older than
4.14, is outside what this package supports, and confining files while
`fork` and `socket` stay open would be a sandbox in name only.

**No environment variable or runtime knob weakens the sandbox.** The mode is
a constant in the IR; `nish_sandbox` reads no environment variable, file or
argument that can widen it. `nish_cpu_count` reads `NISH_NUM_THREADS`
(`runtime/runtime-parallel.c:157`) after the sandbox applies (§4), and the
variable only lowers the pool's size. The only way to a weaker sandbox is to rebuild with a
different flag, which changes the binary and its run-cache key. Testing the
missing-kernel path (§8) uses a compile-time define in a test-only build of
the runtime unit, never a runtime switch.

## 7. Platforms

| Platform | `--sandbox` |
|---|---|
| `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu` | confined as §4 says |
| `x86_64-apple-darwin`, `aarch64-apple-darwin` (`src/target.ts:45-52`) | refused at compile time (§2); Seatbelt is out of scope |
| `wasm32-unknown-unknown`, `wasm32-wasi` | accepted, no call emitted: a wasm module can reach only what its host imports into it |
| an N-API addon (`scripts/build.sh --profile napi`) | has no `main` wrapper, so the flag is refused as for an entry without `main` |
| a target-neutral `.ll` linked by hand on a non-Linux host | the stub in `runtime-sandbox.c` refuses to run, exit 126 |
| Linux with a C library that skips `.preinit_array` (musl) | unsupported: `nish_sandbox_check` refuses at `main`, exit 126, after any constructor has run unconfined (§3) |

The seccomp filter checks `seccomp_data.arch` first and kills on a mismatch, so
a 32-bit entry, `int 0x80` on x86-64 or AArch32 compat on AArch64, cannot step
around the 64-bit numbers. The arch check alone does not cover x32, which
reports `AUDIT_ARCH_X86_64`; on x86-64 the filter's next instruction kills any
number with bit 30 set (§4), before any number is compared.

## 8. The tests

Every native check lives in `tests/run.js`, in a new `sandbox` section, as a
bespoke check (the shape `par_dst_short` uses: `spawnSync` the binary, then
`check(name, condition, detail)`), not as a `tests/link/` fixture:
`runNative` treats any death by signal as a failure ("the native run died
on", `tests/run.js:746`), and these checks expect one.

| Check | Expects |
|---|---|
| `sandbox: fork from ffi without process.spawn dies of SIGSYS` | exit status 159 through `nish run --sandbox` |
| `sandbox: execve from ffi without process.spawn dies of SIGSYS` | 159 |
| `sandbox: socket from ffi without net dies of SIGSYS` | 159 |
| `sandbox: an x32 socket from ffi dies of SIGSYS` | 159 on x86-64; on AArch64 the check calls `skip("sandbox: x32 is an x86-64 ABI; the bit-30 check did not run")` |
| `sandbox: io_uring_setup from ffi without net dies of SIGSYS` | 159 |
| `sandbox: process_vm_writev into the parent dies of SIGSYS` | 159, and the same for `ptrace(PTRACE_ATTACH)` on the parent, under both modes |
| `sandbox: chmod, utimensat and setxattr without fs.write fail EPERM` | `EPERM` printed for each, and the file's mode, times and attributes unchanged after the run |
| `sandbox: open from ffi without fs.read is refused` | `EACCES` printed by the program, exit 0 |
| `sandbox: fs.read=<dir> reads inside and not outside` | a file in one temporary directory read; a file the check writes in a second temporary directory, outside the scope, refused with `EACCES` |
| `sandbox: a process.spawn-granted program runs a child` | the child's stdout through `spawnSync`, exit 0 |
| `sandbox: a device ioctl without process.spawn is refused` | `ioctl(TCGETS)` on `/dev/null` opened after the call answers `EACCES` where unsandboxed it answers `ENOTTY`; below ABI 5, `skip("sandbox: this kernel has no IOCTL_DEV (ABI <5); the ioctl check did not run")` |
| `sandbox: a libc that skips .preinit_array fails closed` | the golden's IR with the entry's `section` removed, linked: exit 126 and §3's message |
| `sandbox: a spawn redirect without fs.write fails in the child` | the child's open refused, the parent's `spawnSyncTo` reporting the failure, no file created |
| `sandbox: a process holding capabilities drops them` | under `unshare -r`, `CapEff`, `CapPrm`, `CapInh` and `CapAmb` in `/proc/self/status` all 0 after the call, and `CapBnd` 0; where unprivileged user namespaces are off, `skip("sandbox: no unprivileged user namespace; the capability drop did not run")` |
| `sandbox: a constructor in an ffi object runs confined` | an `ffi` object's `__attribute__((constructor))` that opens a file without `fs.read` prints `EACCES` |
| `sandbox: the sandbox's preinit entry runs first` | an `ffi` object carrying its own `.preinit_array` entry that opens a file is refused in the same way |
| `sandbox: a granted program runs as it does unsandboxed` | byte-identical stdout with and without `--sandbox`, and again with `--threads` |
| `sandbox: a threaded program without process.spawn still runs its pool` | the pool's answer, exit 0 |
| `sandbox: NISH_NUM_THREADS still lowers the pool` | a `--threads` program, linked dynamically (the default) and run with `NISH_NUM_THREADS=1`, starts no worker thread, sandboxed as unsandboxed (`Threads:` in `/proc/self/status`, printed by an `ffi` helper) |
| `sandbox: a missing scope directory refuses strict` | the scope removed after the build: exit 126 naming it; best-effort names it once and exit 0 |
| `sandbox: strict refuses without Landlock` and `sandbox: best-effort warns without Landlock` | exit 126 and the message; stderr's one line and exit 0 |
| `sandbox: strict refuses below ABI 3 without fs.write` | against the ABI 1 and ABI 2 builds below: exit 126; best-effort's line names `TRUNCATE` |
| `sandbox: the wasm profile refuses sandboxed IR` | `scripts/build.sh --profile wasm` on a host `.ll` built with `--sandbox`: exit 2 and §3's message |
| `sandbox: no golden moves without the flag` | the IR of every `tests/cases/` program unchanged |
| `sandbox: the wasm targets emit no call` | no `@nish_sandbox` in the `.ll` |

The darwin refusal, a checker diagnostic, goes in `tests/wordings/`. The
`--sandbox=<bad>` and scope usage errors are CLI errors, so they go in
`tests/nish/cli.ts` beside the check "scopes a capability to a directory".
The IR shape goes in a golden `.ll` with an `llvm-as` pass, and each refusal
of §2 gets a negative case.

**A Landlock-gated check skips with a named reason.** The section probes the
host once with the same `landlock_create_ruleset` call the wrapper makes. Below
ABI 1 every check that needs Landlock calls `skip("sandbox: this kernel has no
Landlock (ABI 0); the fs checks did not run")`, which `tests/run.js`'s `skip`
(`:280-283`) prints and counts, so a degraded run is visible in the skip count.

**The missing-kernel path is tested without a runtime knob.** The section
compiles extra copies of `runtime-sandbox.c` with
`-DNISH_SANDBOX_SIMULATE_ABI=<n>`, which makes the ABI probe answer `n`, for
0, 1 and 2, and links the strict and best-effort fixtures against each. The define is not in
`build.sh`'s flags, so no shipped runtime can carry it, and no binary reads it
at run time.

**Budget rows.** `runtime-os.c` measures 1,530 of its 1,536 bytes of `.text*`
(`RUNTIME_OS_TEXT_BUDGET`, `tests/runtime-budgets.js:86`; measured at
`c8a00d6` with `clang -Oz -c`, Ubuntu clang 18.1.3), so the sandbox cannot
live there. `runtime-sandbox.c` gets its own row in the table at
`tests/runtime-budgets.js:393-413`, shaped as the others,
`["runtime/runtime-sandbox.c", RUNTIME_SANDBOX_TEXT_BUDGET,
"RUNTIME_SANDBOX_TEXT_BUDGET", []]`, its ceiling set from the implementation's
measurement with the figure in the comment beside it. `node tests/run.js
runtime-budget` gates it. Splitting `nish_cpu_prime` out of
`nish_cpu_count` (§4) edits `runtime/runtime-parallel.c`, so
`RUNTIME_PARALLEL_TEXT_BUDGET` and `RUNTIME_PARALLEL_THREADS_TEXT_BUDGET`
(`tests/runtime-budgets.js:148`, `:228`) may move too, each with its
comment's figure re-measured.

**The CI grep step.** The fs checks pass on a kernel with Landlock and skip on
one without, so a runner that lost Landlock would stay green. CLAUDE.md's rule
for checks gated on `/proc/cpuinfo` applies: `.github/workflows/ci.yml` gets a
step beside "The lowered AES program ran the kernels"
(`.github/workflows/ci.yml:316-319`) that greps
`'^PASS  sandbox: fs.read=<dir> reads inside and not outside'` from the
shard's `test.log`. It is required only once the kernel row of §5 is
measured on that runner.

## 9. What ships with it

- `docs/LANGUAGE.md`: a "The sandbox" rule under "Capabilities", after "The
  capability policy".
- `docs/guide/`: a page on `--sandbox`, routed in `scalar.config.json`, with
  the exit status 159 and the fallback messages.
- `docs/IR_COOKBOOK.md`: the wrapper call, and the regenerated runtime prelude.
- `docs/security/sandbox.md`: the area's record, opening with the threat
  model below and the mapping check after it.
- `tests/self/goldens/checked.txt` and `checked-self.txt`: regenerated with
  `node tests/self/goldens.js --update`, since the stage edits `src/`; and
  `node tests/differential/goldens.js --update` in the commit that adds a
  positive `tests/cases/*`.
- `THIRD_PARTY_NOTICES.md`: nothing, unless the filter is adapted from
  elsewhere; the BPF program is written for this unit.
- One `feat(cli)` commit per stage, its body the changelog entry.

### The threat model

The record states it in these words, and every row of §4 is checked against
it.

**Who is trusted.** The person who launches the binary, and everything that
person controls: the environment (`LD_PRELOAD` and `LD_AUDIT` among it), the
arguments, the working directory, the link line and the toolchain. Also
trusted are the compiler and the mask it computes, which `--sandbox`
enforces rather than checks, and the kernel.

**Who is the adversary.** All code in the process that runs after the
preinit call of §3: the program's Nish code, `std`, every dependency, every
`ffi` callee, and every constructor, in the executable, in an `ffi` object
or in a shared library. Its aim is to do what the mask withholds.

**With what privilege.** Whatever the launch gave, as uid 0, with file
capabilities or with a container's default set, step 3 of §3 drops every
capability before the adversary runs, and `NO_NEW_PRIVS` keeps an `exec`
from gaining one back. The identity stays. A uid-0 process still owns
root's files, so Landlock and the metadata-write rule are what hold it to
the mask, not file modes. It can also signal other uid-0 processes, which
open question 8's scoping limits from ABI 6. A user namespace the adversary
creates gives it capabilities only over the namespace's own objects:
`init_module`, `kexec_load`, `open_by_handle_at` and `bpf` check the initial
namespace, the domain and the filter stay attached, and Landlock refuses
`mount` in a confined process.

**What `ffi` code is allowed.** The mask is computed from the Nish code, so
an `ffi` callee is held to what the Nish code reaches, not to what the C
code needs (§1). That errs towards refusal: a C library that needs more is
killed or refused, never granted more. Whether a policy may widen it is open
question 13.

**What runs before the call.** The dynamic loader, `LD_AUDIT`, `LD_PRELOAD`'s
interposition and libc's own start-up run first. They are the launcher's
choice, so they are out of scope by this statement. An IFUNC resolver in an
`ffi` object or in a `DT_NEEDED` shared library also runs first, and it is
adversary code: that is a limit on what `--sandbox` holds (open question
11). On a C library that skips `.preinit_array` every constructor runs
first as well, and the program then refuses to run (§3, §7).

**What the adversary keeps.** Under the mask it was given, it keeps:

- descriptors open before the call, and any it receives over `SCM_RIGHTS`;
- of `/proc/self`, what needs no open: `stat` and `readlink` on its
  entries, and descriptors to it already open; opening its files needs
  `fs.read` (open question 6);
- a terminal open before the call, fd 0 included, with `TIOCSTI` where
  `dev.tty.legacy_tiocsti` is 1, and below ABI 5 a terminal it reopens with
  `fs.read` (§4, open question 12);
- what argument-level checks would be needed to withhold (§10): `ioctl`'s
  `FS_IOC_SETFLAGS` and `FS_IOC_FSSETXATTR` on a read-only descriptor, and
  `mmap` with `PROT_EXEC`;
- the metadata reads of §4: `stat`, `lstat`, `statx`, `readlink`, `access`,
  `getxattr`, `listxattr`, `O_PATH`, `chdir`, `inotify` and `fanotify`;
- io_uring, when both `net` and `process.spawn` are granted;
- the same-uid routes no row kills: SysV shared memory and message queues
  (`shmget`, `shmat`, `msgget`) shared with an unconfined process of the
  same user, `perf_event_open` within what `perf_event_paranoid` allows, and
  `kcmp`'s comparison of another process's descriptors;
- signals to its own uid (until ABI 6), the clock, entropy and the
  environment;
- under best-effort without Landlock, every file the user can reach,
  `/proc/<pid>/mem` of another process included;
- under `process.spawn`, read and execute on every file (open question 5);
- kernel bugs, which no part of a sandbox in the same kernel holds;
- the IFUNC resolvers above, and every constructor on a libc that skips
  `.preinit_array`;
- everything, on macOS, where `--sandbox` is refused (§7).

**Checked against the mapping.** Each route to a withheld capability lands on
one of these:

- **Files:** Landlock's rights (§4), with the metadata writes in seccomp. On a
  uid-0 process, Landlock holds where file modes would not.
  `open_by_handle_at` walks past path rules, but it needs
  `CAP_DAC_READ_SEARCH`, which step 3 drops.
- **Processes:** the `process.spawn` row, `clone3`'s `ENOSYS` and the
  io_uring kill. A module that loads one (`finit_module`) and `bpf` are
  refused `EPERM` after step 3.
- **The network:** the `net` row, the io_uring kill and the x32 kill.
- **Another process:** the always-on `ptrace`, `process_vm_*` and
  `pidfd_getfd` kills.

What lands on none of these is in the list above, by name. A route found
later is either added to §4's rows or added to that list, never left
unstated.

## 10. Out of scope

- Per-dependency policies: one process, one domain.
- Argument-level syscall checks beyond `clone`'s flags.
- A sandbox for macOS (Seatbelt) or Windows.
- A `nish:sandbox` builtin a program calls on itself.
- Confining `clock`, `entropy`, `env`, `signal`, `exit`, `unsafe` and `ffi`
  (§4 says why each).
- Network scoping by port with Landlock ABI 4 (open question 7).
- Making `nish run` sandbox by default (open question 10).
- Changing the identity of a privileged launch: capabilities are dropped, the
  uid is kept (§9).

## 11. Open questions

1. **`fs.write=<dir>`, and scopes in the manifest.** (a) Accept
   `fs.write=<dir>` with `fs.read=<dir>`; (b) accept only `fs.read=<dir>` at
   first; (c) also accept scopes in `package.json`'s `"nish"` field, resolved
   against the package root. *Recommendation: (a) on the command line,
   because Landlock handles both alike; leave the manifest to a later stage,
   since a relative scope in a published package names a directory on
   someone else's machine.* Under (a), the metadata writes of §4 stay
   refused inside the directory too: seccomp cannot see the path, so a
   program granted `fs.write=<dir>` cannot `chmod` or `utimensat` there.
   Granting them whenever any `fs.write` is present would let such a
   program `chmod` every file the user owns; the implementation keeps them
   refused and the guide page says so. A scoped `fs.write` needs ABI 3,
   since below it `truncate` on a file outside the directory cannot be
   withheld, so only `fs.write` granted whole runs on 5.13 (§6).
2. **The exit status of a refused start.** (a) 126, the shell's "found but
   cannot run"; (b) 1, a panic's; (c) 159, as if killed. *Recommendation:
   (a): it tells a script the program never started, apart from both its own
   failure and a kill.*
3. **Whether best-effort exists.** (a) Keep it; (b) strict only; (c) best-effort
   only. *Recommendation: (a). A kernel older than 5.13 is still common on
   long-term distributions, and a user who chooses best-effort sees the line
   saying what was not confined; strict stays the spelling with no suffix.*
4. **seccomp's default action.** (a) A denylist: allow everything, kill the
   calls §4 lists; (b) an allowlist of the calls the runtime makes.
   *Recommendation: (a) first. An allowlist breaks on every libc and kernel
   update and on every `ffi` callee, and the denylist covers the capabilities
   the compiler computes; an allowlist is a later, separate flag.* A
   denylist is only as good as its list of routes: x32 and io_uring each
   stepped around a row of the first draft. The implementation's security
   record keeps §4's siblings probe, and a kernel that adds a route (a new
   io_uring opcode, a new `*at2` syscall) is reviewed against it.
5. **The `process.spawn` widening.** (a) Grant `EXECUTE` and `READ_FILE`
   beneath `/`; (b) grant them beneath the `PATH` directories and the loader's
   library directories only; (c) refuse `--sandbox` together with
   `process.spawn`. *Recommendation: (a), recorded in the security record:
   (b) breaks on every system whose layout differs, and (c) loses every build
   tool.*
6. **`/proc/self` and the cgroup files.** (a) Prime the pool's ceiling before
   confinement; (b) grant read on `/proc/self` and `/sys/fs/cgroup` always;
   (c) accept the fallback. *Recommendation: (a): it needs no right, and (b)
   would leave `/proc/self/environ` and `/proc/self/mem` readable to a program
   denied `fs.read`.*
7. **Landlock network rules or seccomp for `net`.** (a) seccomp kills
   `socket`; (b) Landlock ABI 4 denies TCP `bind` and `connect`; (c) both when
   ABI 4 is present. *Recommendation: (a): together with the io_uring kill
   of §4, which (a) needs, it covers UDP and every family on every
   supported kernel, which ABI 4 does not; a port-scoped `net=<port>` is
   where (b) would earn its place, later.*
8. **Landlock ABI 6's scoping.** (a) Scope abstract unix sockets and signals
   whenever ABI 6 is present; (b) leave them. *Recommendation: (a): Nish has
   no builtin that signals another process or uses an abstract socket, so the
   scope costs nothing, and best-effort names it when the ABI is older.*
9. **A new unit or a define.** (a) `runtime-sandbox.c`, always built, dropped
   by `--gc-sections` when unused; (b) a `-DNISH_SANDBOX` define in an existing
   unit, as #451's draft had, which moves `runtimeCacheKey` and the build
   recipe. *Recommendation: (a): no key change, no recipe flag, its own budget
   row, and `runtime-os.c` has 6 bytes left.*
10. **Whether `nish run` defaults to `--sandbox` one day.** (a) Never; (b)
    after a release with the flag, behind a manifest field; (c) once CI has
    measured Landlock on every runner. *Recommendation: (c), proposed in its
    own note: a default that refuses to start on older kernels is a break the
    stability rule at the head of LANGUAGE.md would have to allow.*
11. **IFUNC resolvers in `ffi` objects and needed libraries.** A resolver
    runs during relocation, before the preinit call (§3), so an `ffi` object
    or a `DT_NEEDED` shared library can run code unconfined. (a) State it as a limit in the record and the guide page;
    (b) also refuse, at link time, an `ffi` object carrying an
    `STT_GNU_IFUNC` symbol or an `R_*_IRELATIVE` relocation; (c) nothing.
    *Recommendation: (a) now, (b) in a later stage. The objects a Nish
    program links are the author's own or a dependency's, which the launcher
    already chose to trust, and libc's own IFUNCs are libc start-up. (b)
    needs a pass over each object's symbol table on the link path, and it
    would refuse libraries that use IFUNC for CPU dispatch, as libgcc does,
    and could not reach a shared library's resolvers at all.*
12. **`IOCTL_DEV` below ABI 5.** On 5.13 to 6.9 a program granted `fs.read`
    can reopen `/dev/tty` and `ioctl` it, `TIOCSTI` included. (a) State it,
    as §4 and §9 do; (b) refuse strict below ABI 5 unless `process.spawn` is
    granted, raising that floor to 6.10. *Recommendation: (a). A terminal
    already on fd 0 gives the same power on every ABI, so (b) would raise the
    floor without closing the route; `dev.tty.legacy_tiocsti=0` closes both,
    and the guide page names it.*
13. **What `--allow` means for an `ffi` program under `--sandbox`.** The
    computed mask carries `ffi` and nothing for the C code behind it (§1),
    and `ffi` maps to no right (§4), so the C code gets nothing the Nish code
    does not reach and no flag can widen it. (a) For a program whose mask
    has `ffi`, confine to the computed set together with the `net`, `fs.*`
    and `process.spawn` grants of its policy (`--allow`, `--deny`, the
    manifest), scopes included; a program without `ffi` keeps the computed
    set; (b) let `--allow` widen the mask only for capabilities the `ffi`
    declaration itself names, which needs a new annotation on `declare
    function`; (c) refuse `--sandbox` for a program whose mask has `ffi`;
    (d) state the limit as it is. *Recommendation: (a). The policy is where
    a user already says what the program may do, and NL2459 keeps it honest
    for the Nish code, so it is the one place that can speak for the C code
    too, and it needs no new syntax. Without a policy the program stays
    confined to the computed set, as (d). (b) puts a claim about C code in
    Nish source the compiler cannot check, and (c) refuses the programs a
    sandbox helps most.*
