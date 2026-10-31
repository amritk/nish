# `--sandbox`: holding a running process to `main`'s capabilities

The record for the OS sandbox's first two stages: the `--sandbox` flag, the
wrapper calls it lowers to, `runtime/runtime-sandbox.c`, which applies it, and
the `fs.read=<dir>` and `fs.write=<dir>` scopes it enforces. It says
what the sandbox withholds, against which adversary, what it leaves that
adversary, and which test pins each answer. The design and its open questions
are [`wp37-os-sandbox.md`](../wp37-os-sandbox.md); a `§` or an "open question"
below is that note's. It was written on `main` at `804120e` and names
functions rather than lines, so it has no `file:line` anchors to move.

## Scope

| File | What |
| --- | --- |
| `runtime/runtime-sandbox.c` | `nish_sandbox` (the six steps), `nish_sandbox_check`, `nish_sb_drop_capabilities`, `nish_sb_landlock`, `nish_sb_granted`, `nish_sb_scope`, `nish_sb_rule`, `nish_sb_seccomp` and its syscall tables; the non-Linux stubs |
| `src/emit.ts` | the wrapper: `@.sandbox.apply`, its `.preinit_array` entry kept by `@llvm.used`, the call of `@nish_sandbox_check` first in `@main`, and the scope constants `@.sandbox.read` and `@.sandbox.write` (`sandboxDirs`) |
| `src/compile.ts`, `src/options.ts` | the flag, its modes, and the refusals: darwin (NL3044), `--emit-napi`, `--emit-napi-async`, `--emit-ts`, `--emit-ast`, `--emit-checked`, `--fix`, two modes at once, an entry with no `main`; the scopes (`capabilityListMask`, `capabilityScopes`): which are accepted, and each directory's resolution |
| `src/compilation.ts` | `sandboxWidened`, the widening of an `ffi` main by the policy's grants (open question 13) |
| `runtime/runtime-parallel.c` | `nish_cpu_prime` and the ceiling `nish_cpu_count` clamps to, step 1 |
| `runtime/nish.h` | the declarations of `nish_sandbox`, `nish_sandbox_check` and `nish_cpu_prime` |
| `scripts/build.sh` | the refusal of `--sandbox` IR under the wasm and wasi profiles |

Out of scope: scopes in `package.json`'s `"nish"` field, which stay refused
(open question 1), and scopes of any capability but `fs.read` and
`fs.write`, which are refused.

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
killed or refused, unless the policy grants it. A main that reaches `ffi`
under an allowlist (`--allow`, the manifest's `allow`, or both, intersected)
is widened by that list's `net`, `fs.read`, `fs.write` and `process.spawn`,
less any denial, a directory scope kept as a scope (open question 13). The
widening is the person building the program choosing what the C code may
reach; it never exceeds what the policy writes, and without an allowlist
nothing is widened.

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
  same user, `perf_event_open` within what `perf_event_paranoid` allows,
  `kcmp`'s comparison of another process's descriptors, and
  `process_madvise` (440) on a same-uid process it holds a pidfd to;
- signals to its own uid (until ABI 6), the clock, entropy and the
  environment;
- under best-effort without Landlock, every file the user can reach,
  `/proc/<pid>/mem` of another process included;
- under `process.spawn`, read and execute on every file (open question 5),
  a `fs.read=<dir>` scope notwithstanding;
- inside an `fs.write=<dir>` scope, nothing more than outside it of the
  metadata writes: `chmod`, `chown`, `utimensat` and the extended-attribute
  writes still answer `EPERM` there (open question 1);
- beneath a scope, everything under the directory as the binary opens it at
  start, not as the compiler resolved it (see Limits), including a directory
  later moved or bind-mounted beneath it;
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
  io_uring kill. A module that loads one (`finit_module`) is refused `EPERM`
  after step 3. `bpf` is refused `EPERM` where
  `kernel.unprivileged_bpf_disabled` is 1 or 2, the default of most
  distributions; where it is 0, an unprivileged process may still load a
  socket filter, which reaches no capability the mask withholds.
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
   grants whole — `fs.read`: READ_FILE, READ_DIR; `fs.write`: WRITE_FILE, the
   MAKE_* and REMOVE_* rights, REFER, TRUNCATE; `process.spawn`: EXECUTE,
   READ_FILE and IOCTL_DEV (open question 5). A scoped `fs.read` or
   `fs.write` (the third and fourth operands, each a list of directories
   ended by a NUL and the list by a second, `null` for none) is left out of
   the rule on `/` and granted by one `path_beneath` rule per directory,
   opened `O_PATH | O_DIRECTORY`; a directory that cannot be opened refuses
   strict and, under best-effort, is named and left out, which only narrows
   what is granted.
5. A seccomp denylist (open question 4), `SECCOMP_FILTER_FLAG_TSYNC`:
   - an architecture other than the build's kills, and on x86-64 a number with
     bit 30 (x32) kills;
   - always: `ptrace`, `process_vm_readv`, `process_vm_writev`, `pidfd_getfd`
     kill;
   - without `net`: `socket`, `socketpair`, `connect`, `bind`, `listen`,
     `accept`, `accept4` kill;
   - unless both `net` and `process.spawn`: `io_uring_setup`, `_enter`,
     `_register` kill;
   - without `fs.write`, or with it only beneath directories: the mode,
     owner, times and extended-attribute writes answer `EPERM`;
   - without `process.spawn`: `execve`, `execveat`, `fork`, `vfork` kill,
     `clone3` answers `ENOSYS`, and `clone` kills unless `CLONE_THREAD` is
     set.
6. Marks itself applied; `nish_sandbox_check`, `@main`'s first call, exits
   126 if it was not.

A failure in any step prints `nish: --sandbox: <what> (<errno>)` and exits
126. The two modes differ only where Landlock is missing or too old: strict
exits 126 without Landlock, or below ABI 3 when `fs.write` is not granted
whole (TRUNCATE could not be withheld); best-effort runs and names what it
could not withhold. A scope directory that cannot be opened is the one
failure the modes treat differently outside Landlock's ABI: strict exits 126,
`nish: --sandbox: cannot open the directory <dir> (<errno>)`, and best-effort
names it once and runs with nothing granted beneath it.

## Findings

None. Both stages are new code; what it does not hold is stated in the threat
model's "What the adversary keeps" list above, and the limits below are
recorded rather than counted.

## Limits

- **What runs before the preinit call.** The loader, `LD_PRELOAD`,
  `LD_AUDIT`, libc's start-up and IFUNC resolvers (open question 11).
- **IOCTL_DEV below ABI 5.** A device opened with `fs.read` takes any
  `ioctl` there; strict runs anyway, since a terminal already on fd 0 gives
  the same on every ABI (open question 12).
- **The scopes below ABI 6.** Signals to the same uid and abstract Unix
  sockets are not scoped; strict runs anyway (open question 8). `nish:net`'s
  `unixConnect` reaches abstract names, so below ABI 6 a sandboxed program
  granted `net` can connect to an abstract listener outside the sandbox; from
  ABI 6 that connect is -1 (`EPERM`), and its own abstract listeners still
  work.
- **A pathname Unix listener needs `fs.write`.** Landlock counts binding a
  socket file as MAKE_SOCK, a write, so `unixListen` on a path under `net`
  alone is -13 and leaves no file. The capability pass grants `net` for the
  call and does not infer `fs.write`, since the path is data; a program that
  listens on a path asks for both, or uses an abstract name. Pinned by the
  two `sandbox: granted net …` checks in `tests/run.js`.
- **A pathname Unix connect is not confined.** The sandbox uses no Landlock
  right that covers connecting to a pathname socket: a later ABI adds
  `LANDLOCK_ACCESS_FS_RESOLVE_UNIX`, which `runtime/runtime-sandbox.c` does
  not ask for, and the abstract-socket scope covers abstract names only. A sandboxed program granted `net` can therefore
  `unixConnect` to any pathname listener outside the sandbox whose file it
  may write and whose directories it may search, such as a system daemon's
  socket; `fs.read` and `fs.write` do not govern it. Recorded open: what
  bounds it is the socket file's mode and its directory's, which the listener
  sets, and a program that must not reach a host's daemons should not be
  granted `net`. Not pinned by a test.
- **A passed descriptor is not checked.** Landlock rules apply when a path
  is opened, and `sendmsg` and `recvmsg` are not in the seccomp filter, so a
  file another process opens and sends with `sendFd` reaches a sandboxed
  `recvFd` usable as it was opened, whatever `fs.read` and `fs.write` grant;
  only making the socket it arrives on needs `net`. A child started with
  `spawnWithFds` likewise holds what its parent handed it. This is the first
  bullet of "What the adversary keeps", now reachable from the language
  (`docs/security/runtime.md`, RT-37 and RT-40): what bounds it is who is at
  the other end, which `peerCredentials` names (RT-39). Not pinned by a test.
- **Scopes are resolved at build time.** The directory is the realpath the
  compiler saw; the binary opens that path when it starts, so a directory
  renamed, removed or replaced by a symlink in between is opened as it then
  is (a symlink is followed, since only the launcher, who is trusted, can
  place one there), or refused if it is gone.
- **A directory cannot hold a comma**, which separates `--allow`'s list.
- **Metadata writes inside an `fs.write` scope** stay `EPERM`, since seccomp
  cannot see the path (open question 1(a)).
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
- a scope directory that opens but is refused by `landlock_add_rule`
  (`EBADFD`, `EINVAL`), and a scope list longer than one directory at run
  time (the compiler emits it, `tests/run.js` checks the constant, no run
  opens two);
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
- `sandbox: strict refuses below ABI 3 with fs.write=<dir>, which grants nothing beneath / (ABI 2)`
- `sandbox: fs.read=<dir> reads inside and not outside`
- `sandbox: an ffi main is widened by the policy's fs.read=<dir>, and held to it`
- `sandbox: a missing scope directory refuses strict, naming it`
- `sandbox: best-effort names a missing scope directory once and reads nothing`
- `sandbox: fs.write=<dir> creates inside and not outside` (ABI 3 or later)
- `sandbox: chmod, utimensat and setxattr inside an fs.write=<dir> scope still fail EPERM` (ABI 3 or later)
- `sandbox: a scope is a NUL-ended list constant passed to nish_sandbox, and llvm-as accepts it`
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
- `` a directory scope beside `--sandbox` is accepted, exit 0 ``
- the scope refusals, each word for word, exit 2: a scope without
  `--sandbox`, a scope in `--deny`, a scope of `net`, a directory that does not
  exist, and a path that is a file
- `tests/wordings/nl3044_sandbox_darwin` (the darwin refusal, word for word)
- `tests/runtime-budgets.js`: `RUNTIME_SANDBOX_TEXT_BUDGET`, the ceiling on
  the unit's `.text`

### Checks CI does not run

- `sandbox: a process holding capabilities drops them` needs an unprivileged
  user namespace (`unshare -r`). GitHub's Ubuntu 24.04 runners set
  `kernel.apparmor_restrict_unprivileged_userns=1`, so `unshare -r` fails
  there and the section prints `SKIP sandbox: no unprivileged user namespace;
  the capability drop did not run` instead. It runs, and passes, on a machine
  that allows unprivileged user namespaces; on CI the drop is proved only by
  its read-back, which fails closed.
- `sandbox: a pool without fs.read keeps to a cgroup quota of N CPUs, primed
  before confinement` needs a private mount namespace in a user namespace
  (`unshare -rm`) to put a tmpfs over `/sys/fs/cgroup`, so it is refused on
  those runners for the same reason and prints `SKIP sandbox: no mount
  namespace with a cgroup tmpfs; the primed CPU count was not checked`. It
  also skips on a host with fewer than 3 CPUs, or more than 65, where the
  pool's own cap of 64 decides the count. It runs, and passes, where the drop
  above does.
