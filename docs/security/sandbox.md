# `--sandbox`: holding a running process to `main`'s capabilities

The record for the OS sandbox's first stage: the `--sandbox` flag, the wrapper
calls it lowers to, and `runtime/runtime-sandbox.c`, which applies it. It says
what the sandbox withholds, against which adversary, what it leaves that
adversary, and which test pins each answer. The design and its open questions
are [`wp37-os-sandbox.md`](../wp37-os-sandbox.md); a `§` or an "open question"
below is that note's. It was written on `main` at `804120e` and names
functions rather than lines, so it has no `file:line` anchors to move.

## Scope

| File | What |
| --- | --- |
| `runtime/runtime-sandbox.c` | `nish_sandbox` (the six steps), `nish_sandbox_check`, `nish_sb_drop_capabilities`, `nish_sb_landlock`, `nish_sb_granted`, `nish_sb_seccomp` and its syscall tables; the non-Linux stubs |
| `src/emit.ts` | the wrapper: `@.sandbox.apply`, its `.preinit_array` entry kept by `@llvm.used`, and the call of `@nish_sandbox_check` first in `@main` |
| `src/compile.ts`, `src/options.ts` | the flag, its modes, and the refusals: darwin (NL3041), `--emit-napi`, `--emit-ast`, `--emit-checked`, `--fix`, an entry with no `main` |

Out of scope, for stage 2: the `fs.read=<dir>` and `fs.write=<dir>` scopes
(still refused beside `--sandbox`, word for word), widening `ffi` (open
question 13), and the third and fourth operands, which are always `null`.

## Threat model

This is §9's statement, in its words; every row of the mapping below is
checked against it.

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

## The mapping

`main`'s capability set is the first operand of `nish_sandbox`, a bitmask in
the report's order (bit 5 `fs.read`, 6 `fs.write`, 7 `net`, 8
`process.spawn`). `nish_sandbox` runs from `.preinit_array`, before every
constructor, and applies, in order:

1. `nish_cpu_prime`, which reads the CPU count (the cgroup's quota among
   it) while files can still be read; the pool takes it as the ceiling for
   `NISH_NUM_THREADS`, whose own read needs no file.
2. `PR_SET_NO_NEW_PRIVS`.
3. The capability drop: the effective, permitted and inheritable sets
   emptied, the ambient set cleared, the bounding set emptied when
   `CAP_SETPCAP` allows it — each read back, not trusted.
4. Landlock: every right the kernel's ABI knows is handled (REFER from ABI 2,
   TRUNCATE from 3, IOCTL_DEV from 5, the signal and abstract-socket scopes
   from 6), and one `path_beneath` rule on `/` grants back the rights the mask
   grants — `fs.read`: READ_FILE, READ_DIR; `fs.write`: WRITE_FILE, the
   MAKE_* and REMOVE_* rights, REFER, TRUNCATE; `process.spawn`: EXECUTE,
   READ_FILE and IOCTL_DEV (open question 5).
5. A seccomp denylist (open question 4), `SECCOMP_FILTER_FLAG_TSYNC`:
   - an architecture other than the build's kills, and on x86-64 a number with
     bit 30 (x32) kills;
   - always: `ptrace`, `process_vm_readv`, `process_vm_writev`, `pidfd_getfd`
     kill;
   - without `net`: `socket`, `socketpair`, `connect`, `bind`, `listen`,
     `accept`, `accept4` kill;
   - unless both `net` and `process.spawn`: `io_uring_setup`, `_enter`,
     `_register` kill;
   - without `fs.write`: the mode, owner, times and extended-attribute writes
     answer `EPERM`;
   - without `process.spawn`: `execve`, `execveat`, `fork`, `vfork` kill,
     `clone3` answers `ENOSYS`, and `clone` kills unless `CLONE_THREAD` is
     set.
6. Marks itself applied; `nish_sandbox_check`, `@main`'s first call, exits
   126 if it was not.

A failure in any step prints `nish: --sandbox: <what> (<errno>)` and exits
126. The two modes differ only where Landlock is missing or too old: strict
exits 126 without Landlock, or below ABI 3 when `fs.write` is not granted
(TRUNCATE could not be withheld); best-effort runs and names what it could not
withhold.

## Findings

None. The stage is new code; what it does not hold is stated in the threat
model's "What the adversary keeps" list above, and the limits below are
recorded rather than counted.

## Limits

- **What runs before the preinit call.** The loader, `LD_PRELOAD`,
  `LD_AUDIT`, libc's start-up and IFUNC resolvers (open question 11).
- **IOCTL_DEV below ABI 5.** A device opened with `fs.read` takes any
  `ioctl` there; strict runs anyway, since a terminal already on fd 0 gives
  the same on every ABI (open question 12).
- **The scopes below ABI 6.** Signals to the same uid and abstract Unix
  sockets are not scoped; strict runs anyway (open question 8).
- **Non-Linux.** Both symbols print `nish: --sandbox: this platform has no
  sandbox` and exit 126, so a `.ll` built for Linux and linked elsewhere
  refuses to run rather than run unconfined.

### Branches the tests do not reach

Each is a kernel answer the test machines do not give; each fails closed:

- `capget`/`capset` failing, `PR_CAPBSET_DROP` or `PR_CAP_AMBIENT_CLEAR_ALL`
  failing other than `EINVAL`, and each "survived the drop" read-back;
- the Landlock ABI probe failing with an errno other than `ENOSYS`,
  `EOPNOTSUPP` or `EPERM`; `landlock_create_ruleset`, `open("/")`,
  `landlock_add_rule` or `landlock_restrict_self` failing;
- ABI 3 and 4 (exercised only as the simulated 0, 1 and 2 and the machine's
  own), and the best-effort line's IOCTL_DEV and scope names on a real kernel
  below ABI 5 or 6;
- `SECCOMP_GET_ACTION_AVAIL` refusing `KILL_PROCESS`, and
  `SECCOMP_SET_MODE_FILTER` failing;
- `PR_SET_NO_NEW_PRIVS` failing;
- the aarch64 tables, which compile but run on no test machine;
- the non-Linux stubs.

## Tests

The `sandbox` section of `tests/run.js` (`node tests/run.js sandbox`) and the
`--sandbox` block of `tests/nish/cli.ts`:

- `sandbox_hello: IR matches golden`
- `sandbox_hello: llvm-as accepts IR`
- `sandbox_hello: --emit-panics changes no byte of the IR, and agrees with it`
- `sandbox_hello: native output matches .out`
- `sandbox: fork from ffi without process.spawn dies of SIGSYS (strict)`
- `sandbox: execve from ffi without process.spawn dies of SIGSYS (strict)`
- `sandbox: socket from ffi without net dies of SIGSYS (strict)`
- `sandbox: io_uring_setup from ffi without net dies of SIGSYS (strict)`
- `sandbox: process_vm_writev into the parent dies of SIGSYS (strict)`
- `sandbox: ptrace(PTRACE_ATTACH) on the parent dies of SIGSYS (strict)`
- `sandbox: an x32 socket from ffi dies of SIGSYS (strict)`
- `sandbox: fork from ffi without process.spawn dies of SIGSYS (best-effort)`
- `sandbox: execve from ffi without process.spawn dies of SIGSYS (best-effort)`
- `sandbox: socket from ffi without net dies of SIGSYS (best-effort)`
- `sandbox: io_uring_setup from ffi without net dies of SIGSYS (best-effort)`
- `sandbox: process_vm_writev into the parent dies of SIGSYS (best-effort)`
- `sandbox: ptrace(PTRACE_ATTACH) on the parent dies of SIGSYS (best-effort)`
- `sandbox: an x32 socket from ffi dies of SIGSYS (best-effort)`
- `sandbox: without --sandbox the same probe forks (the control)`
- `sandbox: a process.spawn-granted program runs a child`
- `sandbox: chmod, utimensat and setxattr without fs.write fail EPERM`
- `sandbox: open from ffi without fs.read is refused`
- `sandbox: a program whose main reaches fs.read opens /etc/passwd`
- `sandbox: a constructor in an ffi object runs confined, and the sandbox's preinit entry runs first`
- `sandbox: a device ioctl without process.spawn is refused`
- `sandbox: a spawn redirect without fs.write fails in the child`
- `sandbox: a granted program runs as it does unsandboxed`
- `sandbox: strict refuses without Landlock (ABI 0)`
- `sandbox: best-effort warns without Landlock (ABI 0)`
- `sandbox: strict refuses below ABI 3 without fs.write (ABI 1)`
- `sandbox: best-effort names TRUNCATE below ABI 3, and still confines the open (ABI 1)`
- `sandbox: strict refuses below ABI 3 without fs.write (ABI 2)`
- `sandbox: best-effort names TRUNCATE below ABI 3, and still confines the open (ABI 2)`
- `sandbox: strict runs below ABI 3 with fs.write, which grants TRUNCATE anyway (ABI 2)`
- `sandbox: a libc that skips .preinit_array fails closed`
- `sandbox: a process holding capabilities drops them`
- `sandbox: a threaded program without process.spawn still runs its pool`
- `sandbox: NISH_NUM_THREADS still lowers the pool (1)`
- `sandbox: NISH_NUM_THREADS still lowers the pool (3)`
- `sandbox: nish run --sandbox runs the program, and the child it starts, with no_new_privs and a seccomp filter`
- `sandbox: the wasm targets emit no call (wasm32)`
- `sandbox: the wasm targets emit no call (wasm32-wasi)`
- `sandbox: the wasm profile refuses sandboxed IR`
- `sandbox: without the flag the IR is the sandboxed IR less the sandbox's lines`
- `runtime objects: linking sandbox_hello.ll against the default runtime gives the bytes the sources do`
- `runtime objects: linking none-abi0.ll against the runtime built with -DNISH_SANDBOX_SIMULATE_ABI=0 gives the bytes the sources do`
- `runtime objects: linking none-abi1.ll against the runtime built with -DNISH_SANDBOX_SIMULATE_ABI=1 gives the bytes the sources do`
- `runtime objects: linking none-abi2.ll against the runtime built with -DNISH_SANDBOX_SIMULATE_ABI=2 gives the bytes the sources do`
- `` `--sandbox --emit-napi` is a usage error, exit 2 ``
- `` `--sandbox` on an entry with no `main` is a usage error, exit 2 ``
- `` a directory scope beside `--sandbox` is still a usage error, exit 2 ``
- `tests/wordings/nl3041_sandbox_darwin` (the darwin refusal, word for word)
- `tests/runtime-budgets.js`: `RUNTIME_SANDBOX_TEXT_BUDGET`, the ceiling on
  the unit's `.text`
