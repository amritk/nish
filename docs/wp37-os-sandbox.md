# WP37: The OS sandbox — holding a running process to its capabilities

**Status: proposed.** Nothing here is built. Every `file:line` anchor, figure
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
`FunctionFacts.caps`, an eleven-bit mask over the bits `src/capabilities.ts:34-50`
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
  knows the program cannot use.
- It needs no policy. `nish --link --sandbox app.ts` with no `--allow`, no
  `--deny` and no manifest field still confines the binary to what `main`
  reaches, so a sandbox costs a user one flag.
- `main` is the only entry a native process has. The wrapper calls it and
  nothing else, so its mask covers every Nish function the process can run.
  A library's other exports reach the process only through `main`.

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
| `nish app.ts` (IR only), `--emit-*`, `--capabilities` | accepted: the `.ll` carries the call, and a user who links it with their own `clang` gets the confinement |
| `--fix`, `--emit-ast` | refused: neither emits a main wrapper to put the call in |
| an entry with no `main` | refused by the existing check (`src/compile.ts:958`): `--link` and `nish run` already need `main`; on the IR-only route it is a usage error, exit 2, because there is no wrapper to put the call in |
| `--target x86_64-apple-darwin`, `aarch64-apple-darwin`, or a darwin host without `--target` | refused with the next free NL3xxx (NL3038 at `c8a00d6`; the number is taken when the implementation lands) |
| `--target wasm32-unknown-unknown`, `wasm32-wasi` | accepted, and no call is emitted: the host already holds a wasm module to its imports (§7) |

**`fs.read=<dir>` is accepted only with `--sandbox`** (`fs.write=<dir>` is
open question 1).
Today `capabilityListMask` (`src/compile.ts:390-430`) refuses any scope with
"scopes a capability to a directory, which the compiler cannot prove and
nothing enforces" (`src/compile.ts:413`). With `--sandbox` on the same command
line, `--allow fs.read=/srv/data` is accepted: the compiler still sees the
capability whole (the policy check is unchanged, `fs.read` is granted), and the
directory is handed to the wrapper as a Landlock rule. Without `--sandbox` the
refusal stays word for word. The directory is resolved to an absolute,
symlink-free path at compile time and must exist then: a scope to a directory
that is not there would be a rule Landlock cannot open. Whether a manifest may
carry a scope is open question 1.

## 3. The wrapper

`emitEntryWrapper` (`src/emit.ts:756`) builds `define i32 @main(i32 %argc,
i8** %argv)`. With `--sandbox` its first instruction becomes one call, before
the optional `nish_argv_init` (`src/emit.ts:780-782`):

```llvm
@.sandbox.read = private unnamed_addr constant [11 x i8] c"/srv/data\00\00"

define i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_sandbox(i32 33, i32 1, i8* getelementptr inbounds ([11 x i8], [11 x i8]* @.sandbox.read, i64 0, i64 0), i8* null)
  call void @nish_argv_init(i32 %argc, i8** %argv)
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

declare void @nish_sandbox(i32, i32, i8*, i8*)
```

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

**No `.ll` golden moves without the flag.** The call is emitted only when
`--sandbox` is given, the declaration enters the module through `useRuntime`
only then, and no existing test passes `--sandbox`. The implementation PR
shows this with a full `node tests/run.js` section list whose goldens are
byte-identical, and `tests/self/goldens/checked.txt` moves only if a new
positive case is added to `tests/cases/`.

**The runtime half is a new unit, `runtime/runtime-sandbox.c`**, always
compiled and paired in `scripts/build.sh`'s `halves` (`:152`) and
`src/run-cache.ts`'s `runtimeUnits()` (`:74-83`) in one commit, as CLAUDE.md
requires. On Linux it holds `nish_sandbox`; on every other platform the same
symbol prints `nish: --sandbox: this platform has no sandbox` and calls
`_exit(126)`, so a target-neutral `.ll` linked on macOS, or IR built for the
host and linked through the freestanding `--profile wasm` route (CLAUDE.md's
rule on wasm32 lowerings), fails closed rather than running unconfined.
A binary that does not call it loses the unit's `.text` to `--gc-sections`
(`scripts/build.sh:198`), which the speed and size profiles already pass with
`-ffunction-sections`.

**The cache keys need nothing new.** `runCacheKey` hashes every module's IR
(`src/run-cache.ts:300-303`), and the call, its mask and its directory
constants sit in that IR, so `nish run --sandbox` and `nish run` hit different
entries already. `runtimeCacheKey` (`src/run-cache.ts:333`) is unchanged,
because the runtime is built the same way with or without the flag. The
alternative, a `-DNISH_SANDBOX` define as #451's draft had, is open question 9.

The declaration goes into `src/runtime.ts`'s table and its prototype into
`runtime/nish.h`, which moves `docs/IR_COOKBOOK.md`'s runtime prelude;
`docs/cookbook/regen.sh` regenerates it in the same commit.

**What `nish_sandbox` does**, in this order, all before any user code:

1. Prime what confinement would break: `nish_cpu_count()` when the runtime has
   threads (§4, `--threads`).
2. `prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)`. Both Landlock and seccomp need it
   for an unprivileged process.
3. Build a Landlock ruleset from the mask and the directory lists, masked down
   to the ABI the kernel reports (§6), and apply it with
   `landlock_restrict_self`.
4. Load the seccomp filter (§4) with `seccomp(SECCOMP_SET_MODE_FILTER,
   SECCOMP_FILTER_FLAG_TSYNC, ...)`; no other thread exists yet, so `TSYNC`
   only states the intent.
5. Return. A strict-mode failure at any step prints `nish: --sandbox: <what>
   (<errno name>)` on stderr and calls `_exit(126)` (open question 2).

## 4. The mapping

Each capability's bit, when it is **absent** from `main`'s mask, becomes a
Landlock right withheld, a seccomp rule, or nothing, with the reason.

| Capability | Confined by | When absent |
|---|---|---|
| `fs.read` | Landlock | `READ_FILE` and `READ_DIR` withheld everywhere; with `fs.read=<dir>`, granted beneath each directory only |
| `fs.write` | Landlock | `WRITE_FILE`, `MAKE_REG`, `MAKE_DIR`, `REMOVE_FILE`, `REMOVE_DIR`, `MAKE_SYM`, `MAKE_*` for special files, `REFER` (ABI 2) and `TRUNCATE` (ABI 3) withheld; with `fs.write=<dir>` (open question 1), granted beneath it |
| `process.spawn` | seccomp | `execve` and `execveat` kill; `fork`, `vfork` and `clone` without `CLONE_THREAD` kill; `clone3` returns `ENOSYS` |
| `net` | seccomp | `socket`, `socketpair`, `connect`, `bind`, `listen`, `accept`, `accept4` kill |
| `ffi` | nothing | it is the reason the sandbox exists: what an `ffi` callee does is held by the rows above, not by its own bit |
| `unsafe` | nothing | it changes what a Nish expression compiles to, not what the process asks the kernel for |
| `clock` | nothing | `clock_gettime` is a vDSO call, and `statMtimeSync`'s `stat` is not a right Landlock has |
| `entropy` | nothing | `getrandom` (`runtime/runtime-host.c:83`), not a file open, so no Landlock right covers it, and denying a syscall glibc may itself use for its own needs costs more than it buys |
| `env` | nothing | the environment is in the process's own memory before `main` runs; `geteuid` reveals nothing a sandbox can withhold |
| `exit` | nothing | the process may always end |
| `signal` | nothing | `signalFd` and `readSignal` install handlers for the process's own signals; sending a signal to another process is not a Nish builtin, and Landlock ABI 6's signal scoping is open question 8 |

**Rights are withheld, never handled-and-denied piecemeal.** The ruleset
handles every filesystem right the running ABI knows (§6), then adds a
`path_beneath` rule granting back exactly what the mask grants: beneath `/` for
a capability granted whole, beneath each directory for a scoped one.

**What Landlock leaves alone.** `stat`, `lstat`, `readlink` and `access` are not
Landlock rights, so `isDirectorySync` (`runtime/runtime-os.c:204`),
`statMtimeSync` (`runtime/runtime-host.c:104`), `lstatOwnerModeSync` (`:128`),
`isExecutableSync`'s `access(X_OK)` (`:135`) and `realpathSync`'s walk keep
working without `fs.read`. All of them but `statMtimeSync` (`clock`) are
`fs.read` in WP35's table, so a program that uses them has the bit anyway; the
point is only that the sandbox does not break them. A descriptor already open when the ruleset
applies, stdin, stdout and stderr included, keeps working.

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
Step 1 of §3 calls `nish_cpu_count` before the ruleset applies, which caches
the answer in `nish_cpu_cached`, so the count is the unconfined one
(open question 6). `NISH_NUM_THREADS` only lowers the count, so it is not a
way to weaken anything.

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
`fs.write`, and 5.13 (ABI 1) for one with it**, with Landlock enabled; 4.14 for
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
| No Landlock (`ENOSYS` or `EOPNOTSUPP`) | refuses to run: `nish: --sandbox: this kernel has no Landlock; build with --sandbox=best-effort to run with seccomp alone`, exit 126 | prints `nish: --sandbox: no Landlock, files are not confined` once on stderr and continues with seccomp alone |
| Older ABI than the rights the mask withholds | refuses to run when a right §4 withholds is unknown to the ABI: below ABI 3, `truncate(2)` on a file the user owns is not a Landlock right, so a program without `fs.write` needs ABI 3 | handles the rights the ABI knows, and names the ones it could not withhold, once |
| No seccomp, or no `KILL_PROCESS` | refuses to run | refuses to run |

**Missing seccomp is fatal in both modes.** Best-effort exists for kernels
older than Landlock; a kernel with no seccomp filter at all, or older than
4.14, is outside what this package supports, and confining files while
`fork` and `socket` stay open would be a sandbox in name only.

**No environment variable or runtime knob weakens the sandbox.** The mode is
a constant in the IR; `nish_sandbox` reads no environment variable, no file
and no argument. The only way to a weaker sandbox is to rebuild with a
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

The seccomp filter checks `seccomp_data.arch` first and kills on a mismatch, so
a 32-bit syscall entry on x86-64 cannot step around the 64-bit numbers.

## 8. The tests

Every native check lives in `tests/run.js`, in a new `sandbox` section, as a
bespoke check (the shape `par_dst_short` uses: `spawnSync` the binary, then
`check(name, condition, detail)`), not as a `tests/link/` fixture:
`runNative` treats any death by signal as a failure ("the native run died
on", `tests/run.js:746`), and these checks expect one.

| Check | Expects |
|---|---|
| `sandbox: fork from ffi without process.spawn dies of SIGSYS` | exit status 159 through `nish run --sandbox` |
| `sandbox: socket from ffi without net dies of SIGSYS` | 159 |
| `sandbox: open from ffi without fs.read is refused` | `EACCES` printed by the program, exit 0 |
| `sandbox: fs.read=<dir> reads inside and not outside` | a temporary directory's file read, `/etc/hostname` refused |
| `sandbox: a granted program runs as it does unsandboxed` | byte-identical stdout with and without `--sandbox`, and again with `--threads` |
| `sandbox: a threaded program without process.spawn still runs its pool` | the pool's answer, exit 0 |
| `sandbox: strict refuses without Landlock` and `sandbox: best-effort warns without Landlock` | exit 126 and the message; stderr's one line and exit 0 |
| `sandbox: no golden moves without the flag` | the IR of every `tests/cases/` program unchanged |
| `sandbox: the wasm targets emit no call` | no `@nish_sandbox` in the `.ll` |

The darwin refusal and the scope wording go in `tests/wordings/`, the IR shape
in a golden `.ll` with an `llvm-as` pass, and a negative case for each
refusal of §2.

**A Landlock-gated check skips with a named reason.** The section probes the
host once with the same `landlock_create_ruleset` call the wrapper makes. Below
ABI 1 every check that needs Landlock calls `skip("sandbox: this kernel has no
Landlock (ABI 0); the fs checks did not run")`, which `tests/run.js`'s `skip`
(`:280-283`) prints and counts, so a degraded run is visible in the skip count.

**The missing-kernel path is tested without a runtime knob.** The section
compiles a second copy of `runtime-sandbox.c` with
`-DNISH_SANDBOX_SIMULATE_NO_LANDLOCK`, which makes the ABI probe answer 0, and
links the strict and best-effort fixtures against it. The define is not in
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
runtime-budget` gates it.

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
- `docs/security/sandbox.md`: the area's record, whose "does not cover" list
  names open descriptors, `/proc/self`, syscalls outside the filter
  (`ptrace`, `ioctl`, `mmap` with `PROT_EXEC`), signals, the clock, entropy and
  the environment, best-effort without Landlock, the `process.spawn`
  widening, macOS, and trust in the compiler's mask.
- `THIRD_PARTY_NOTICES.md`: nothing, unless the filter is adapted from
  elsewhere; the BPF program is written for this unit.
- One `feat(cli)` commit per stage, its body the changelog entry.

## 10. Out of scope

- Per-dependency policies: one process, one domain.
- Argument-level syscall checks beyond `clone`'s flags.
- A sandbox for macOS (Seatbelt) or Windows.
- A `nish:sandbox` builtin a program calls on itself.
- Confining `clock`, `entropy`, `env`, `signal`, `exit`, `unsafe` and `ffi`
  (§4 says why each).
- Network scoping by port with Landlock ABI 4 (open question 7).
- Making `nish run` sandbox by default (open question 10).

## 11. Open questions

1. **`fs.write=<dir>`, and scopes in the manifest.** (a) Accept
   `fs.write=<dir>` with `fs.read=<dir>`; (b) accept only `fs.read=<dir>` at
   first; (c) also accept scopes in `package.json`'s `"nish"` field, resolved
   against the package root. *Recommendation: (a) on the command line,
   because Landlock handles both alike; leave the manifest to a later stage,
   since a relative scope in a published package names a directory on
   someone else's machine.*
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
   the compiler computes; an allowlist is a later, separate flag.*
5. **The `process.spawn` widening.** (a) Grant `EXECUTE` and `READ_FILE`
   beneath `/`; (b) grant them beneath the `PATH` directories and the loader's
   library directories only; (c) refuse `--sandbox` together with
   `process.spawn`. *Recommendation: (a), recorded in the security record:
   (b) breaks on every system whose layout differs, and (c) loses every build
   tool.*
6. **`/proc/self` and the cgroup files.** (a) Prime `nish_cpu_count` before
   confinement; (b) grant read on `/proc/self` and `/sys/fs/cgroup` always;
   (c) accept the fallback. *Recommendation: (a): it needs no right, and (b)
   would leave `/proc/self/environ` and `/proc/self/mem` readable to a program
   denied `fs.read`.*
7. **Landlock network rules or seccomp for `net`.** (a) seccomp kills
   `socket`; (b) Landlock ABI 4 denies TCP `bind` and `connect`; (c) both when
   ABI 4 is present. *Recommendation: (a): it covers UDP and every family on
   every supported kernel, which ABI 4 does not; a port-scoped `net=<port>` is
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
