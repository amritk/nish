# `--sandbox`: holding a running process to `main`'s capabilities

The record for the OS sandbox's first two stages: the `--sandbox` flag, the
wrapper calls it lowers to, `runtime/runtime-sandbox.c`, which applies it, and
the `fs.read=<dir>` and `fs.write=<dir>` scopes it enforces. It says
what the sandbox withholds, against which adversary, what it leaves that
adversary, and which test pins each answer. The design and its open questions
are [`wp37-os-sandbox.md`](https://github.com/amritk/nish/blob/main/docs/wp37-os-sandbox.md); a `§` or an "open question"
below is that note's. It was written on `main` at `804120e` and names
functions rather than lines, so it has no `file:line` anchors to move.

## Scope

| File | What |
| --- | --- |
| `runtime/runtime-sandbox.c` | `nish_sandbox` (the six steps), `nish_sandbox_check`, `nish_sb_drop_capabilities`, `nish_sb_landlock`, `nish_sb_granted`, `nish_sb_scope`, `nish_sb_rule`, `nish_sb_seccomp` and its syscall tables; `nish_sb_keep_marks` and `nish_sb_spawn_open`, the spawn-target check, and `nish_sb_spawn_once`, `nish_sb_supervisor`, `nish_sb_spawner`, `nish_sb_start`, `nish_sb_answer`, `nish_sb_lift` and `nish_sb_refuse_spawn`, the one exec a spawn's subtree is held to (SBX-1); the non-Linux stubs |
| `src/emit.ts` | the wrapper: `@.sandbox.apply`, its `.preinit_array` entry kept by `@llvm.used`, the call of `@nish_sandbox_check` first in `@main`, and the scope constants `@.sandbox.read`, `@.sandbox.write` and `@.sandbox.exec` (`sandboxDirs`) |
| `src/compile.ts`, `src/options.ts` | the flag, its modes, and the refusals: darwin (NL3044), `--emit-napi`, `--emit-napi-async`, `--emit-ts`, `--emit-ast`, `--emit-checked`, `--fix`, two modes at once, an entry with no `main`; the scopes (`capabilityListMask`, `capabilityScopes`): which are accepted, and each directory's resolution |
| `src/compilation.ts` | `sandboxWidened`, the widening of an `ffi` main by the policy's grants (open question 13); `narrowSandbox`, the scopes and the exec allowlist taken from a dependency's grant arguments, and the `//` mark on an interpreter the grant does not name (WP37 §2a, WP40 §2a) |
| `runtime/runtime-os.c` | `nish_spawn_sandboxed` and its call in `nish_spawn_start`: the spawn handed to the sandbox whole under an exec allowlist, and its error |
| `runtime/runtime-parallel.c` | `nish_cpu_prime` and the ceiling `nish_cpu_count` clamps to, step 1 |
| `runtime/nish.h` | the declarations of `nish_sandbox`, `nish_sandbox_check`, `nish_cpu_prime` and `nish_spawn_sandboxed` |
| `scripts/build.sh` | the refusal of `--sandbox` IR under the wasm and wasi profiles; `-pthread` on every ELF link, for the two threads a spawn under an exec allowlist runs on. A build without `--sandbox` is byte for byte the same on glibc 2.34 and later; before 2.34, where `pthread_create` is in libpthread, it can gain a `DT_NEEDED` on `libpthread.so.0` (the debug profile always, speed and size where `--as-needed` still sees the runtime's reference), one more library of the same glibc loaded at start. Not measured: no test machine has such a glibc |

Out of scope: scopes in `package.json`'s `"nish"` field for the root's own
capabilities, which stay refused (open question 1), and scopes of any
capability but `fs.read` and `fs.write` on the command line, which are
refused. A dependency's grant arguments are the one route by which the
manifest narrows the sandbox; their build-time check is
[capabilities.md](capabilities.md)'s (CAPS-14 to CAPS-20).

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
the mask, not file modes.

It can also signal other uid-0 processes, which
open question 8's scoping limits from ABI 6. A user namespace the adversary
creates gives it capabilities only over the namespace's own objects:
`init_module`, `kexec_load`, `open_by_handle_at` and `bpf` check the initial
namespace, the domain and the filter stay attached, and Landlock refuses
`mount` in a confined process.

**What `ffi` code is allowed.** The mask is computed from the Nish code, so
an `ffi` callee is held to what the Nish code reaches, not to what the C
code needs (§1). That errs towards refusal: a C library that needs more is
killed or refused, unless the policy grants it.

A main that reaches `ffi` under an allowlist (`--allow`, the manifest's
`allow`, or both, intersected) is widened by that list's `net`, `fs.read`,
`fs.write` and `process.spawn`, less any denial, a directory scope kept as a
scope (open question 13). The widening is the person building the program
choosing what the C code may reach; it never exceeds what the policy writes,
and without an allowlist nothing is widened.

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
   READ_FILE and IOCTL_DEV (open question 5).

   A scoped `fs.read` or `fs.write` (the third and fourth operands, each a list
   of directories ended by a NUL and the list by a second, `null` for none) is
   left out of the rule on `/` and granted by one `path_beneath` rule per
   directory, opened `O_PATH` (a directory, or, for the fifth operand, a file);
   a path that cannot be opened refuses strict and, under best-effort, is named
   and left out, which only narrows what is granted.

   The fifth operand, the exec
   allowlist (a list in the same shape: the programs a dependency's
   `process.spawn=<program>` grants name, and the ELF interpreter or `#!`
   interpreter each needs), takes EXECUTE off the rule on `/` and grants it
   on each listed file alone. A directory scope is resolved by the compiler
   and refused there unless it is a directory, so dropping `O_DIRECTORY`
   widens no scope the command line can name.
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

What the sandbox does not hold by design is stated in the threat model's "What
the adversary keeps" list above, and the limits below are recorded rather than
counted. One finding is counted, and it is fixed:

| ID | Severity | Where | What must hold | Status |
| --- | --- | --- | --- | --- |
| SBX-1 | High | `narrowSandbox` in `src/compilation.ts`, `nish_sandbox`, `nish_sb_spawn_open` and `nish_sb_spawn_once` in `runtime/runtime-sandbox.c`, `nish_spawn_start` in `runtime/runtime-os.c` | Under `--sandbox`, a dependency granted `process.spawn=<program>` must run only that program. | **Fixed, in two parts.** The exec allowlist must grant EXECUTE on each granted program's ELF interpreter (`PT_INTERP`, e.g. `/usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2`) and `#!` interpreter, which the kernel needs to start it. Before the fix that loader was a spawn target too: `spawnSync([loader, "/bin/echo", "x"])` was an allowed `execve`, the loader then opened `/bin/echo` under `process.spawn`'s READ_FILE on `/` and mapped it, and Landlock checks EXECUTE at `execve` and open-for-exec, not at `mmap`, so any program ran. Now `narrowSandbox` writes an interpreter the grant does not name with a second leading `/` (`//usr/lib/...`), the same file to Landlock's `O_PATH` open; `nish_sandbox` records each marked entry's `(st_dev, st_ino)` before it confines the process and sets `nish_spawn_sandboxed`. Every spawn then resolves `argv[0]` as `posix_spawnp` would, opens it `O_PATH`, refuses (`EACCES`) a file whose identity is a marked entry's, and otherwise execs that same open file through `/proc/self/fd/N`, so the file checked is the file run: a rename or symlink swap between the check and the `execve` cannot substitute the loader. An interpreter the grant also names (`process.spawn=sh` beside a script) stays unmarked and spawnable. Before/after: `sandbox dependency grants: a granted program's ELF loader is refused as a spawn target (SBX-1)` (sandboxed the spawn returns `-1`; the same build without `--sandbox` runs `echo`), `sandbox dependency grants: a second name for the loader is refused too (SBX-1)`, `sandbox dependency grants: a granted #! script runs and its interpreter is refused as a spawn target (SBX-1)` and `sandbox dependency grants: a program the grant names stays spawnable when it is also another's interpreter (SBX-1)` in `tests/run.js`. **The second part.** That first fix (#1447) kept the loader from the Nish program's own spawns and from nothing below them: Landlock's EXECUTE on the loader holds for the whole process tree, since the kernel needs it to start the granted program, so a granted program that executes a path from its arguments reached it all the same. With `process.spawn=find` granted, `spawnSync(["find", ".", "-maxdepth", "0", "-exec", loader, "/any/binary", ";"])` ran the binary, and `env`, `xargs`, `nice`, `timeout` and `nohup` do the same; SBX-1 was recorded Fixed while this stayed open. Now every spawn under an exec allowlist is held by the kernel to one exec: `nish_sb_spawn_once` runs it on two threads of its own, the spawner installs a seccomp filter that sends `execve` and `execveat` to a user-notification listener (and answers a request for a second listener `EBUSY`) and calls `posix_spawn`, so the child inherits the filter; the supervisor answers the first notification, the child's own exec of the granted program, with "continue" and closes the listener, after which the kernel answers every exec in that child's subtree `ENOSYS`. The supervisor does the identity check and holds the target, the listener and its pipe in a descriptor table of its own (`unshare(CLONE_FILES)`), so no other thread of the program can close or replace one of them between the check and the exec. **The descriptors the child's file actions name.** Those actions are numbers: `dup2(source, base + k)` for the descriptors a builtin passes, and opens onto 1 and 2. A descriptor the hold makes takes the lowest free number, which would be a source another thread closed after the builtin read it, or 0, 1 or 2 where the program closed them, and the child would then be handed the listener or the pipe in place of the file the Nish code named. Three rules close that for every descriptor the hold makes, not one of them: (1) right after `unshare`, before it makes anything, the supervisor checks that each source is open in the private table, and refuses the spawn (`EBADF`) if one is not, so a source that is open is the caller's own and no later allocation can take its number; (2) every descriptor the hold makes (both pipe ends, the listener, the target) is moved by `nish_sb_lift` to `base + n + 3` or above, past every number the actions read from 0, 1 and 2 or write, before any child exists; (3) both pipe ends are moved before either is tested, so the refusal line is never written to stderr while one of them sits on 2. The private table ends with the two threads, so nothing is left to close. Pinned by `sandbox dependency grants: a program granted to <builtin> is started with no descriptor of the sandbox's, stdin and stderr closed (SBX-1)` for `spawnSync`, `spawnPiped`, `spawnPipedWithin`, `spawnWithFds` and `spawn`, which run with 0 and 2 closed and count the non-file descriptors the child holds, the same with and without `--sandbox`; the race with another thread's close is not made deterministic by any test and rests on rule (1), listed under the branches the tests do not reach. Before/after, each against the same build without `--sandbox`, where the ungranted program runs: `sandbox dependency grants: a program granted to <builtin> cannot hand the loader an ungranted binary (SBX-1)` for each of `spawnSync`, `spawnSyncTo`, `spawnPiped`, `spawnPipedWithin`, `spawnWithFds` and `spawn`; `sandbox dependency grants: a granted find cannot hand the loader an ungranted binary (SBX-1)` and the same for `env`; `sandbox dependency grants: a granted program cannot exec another granted program (SBX-1)`; `sandbox dependency grants: a granted program cannot exec itself again (SBX-1)`; and `sandbox dependency grants: a spawn whose child dies before its exec answers the error and does not hang (SBX-1)`. What the hold costs is under Limits. |

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
  not ask for, and the abstract-socket scope covers abstract names only.

  A sandboxed program granted `net` can therefore
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
- **The exec allowlist narrows EXECUTE alone.** `process.spawn` still grants
  READ_FILE and IOCTL_DEV on `/` whole, as it did, since a program it starts
  reads its own libraries; only which files may be executed is narrowed. A
  program the allowlist names may itself be an interpreter, and what it is
  told to run in its own process it still runs: `python3 -c`, `perl -e` and
  `awk` execute any code they are handed, with the process's whole reach of
  every other capability. What an interpreter can no longer do is start a
  second program (the next limit), so a spawned `sh` runs its builtins and
  nothing else. Grant a program that takes code only to a dependency that
  may run anything. The ELF loader and `#!` interpreter the allowlist adds
  for a granted program are refused as spawn targets (SBX-1, fixed above)
  unless the grant names them itself: a grant of `sh` beside a script keeps
  `sh` spawnable, held to its builtins like the script.
- **One exec per spawn.** Under an exec allowlist a spawned program cannot
  start a second program, granted or not, and neither can anything it forks:
  `find -exec`, `xargs`, `env <program>`, `nice`, `timeout`, `make` and a
  shell's non-builtin commands all fail (`ENOSYS`, which a shell reports as
  "not found" or "function not implemented"). A granted `#!` script still
  starts, since the kernel loads its interpreter inside the one `execve`, and
  then runs builtins alone; a script that opens with `#!/usr/bin/env sh` does
  not, because `env`'s exec of `sh` is the second. The hold covers every
  program the Nish binary spawns, the root's own as well as a dependency's,
  whenever the build carries an exec allowlist; a build without one (no
  `process.spawn=<program>` grant, or `process.spawn` granted whole) takes no
  filter and is not held, and neither is a program granted
  `process.spawn=exec:<program>` (the next limit). Granting that, or
  `process.spawn` whole, are the two ways to let a spawned program start
  others.
- **`process.spawn=exec:<program>` lifts the hold for that program, and
  that is an escape by design.** `narrowSandbox` writes the program with
  three leading slashes (`///usr/bin/git`, the same file to Landlock), and
  `nish_sb_keep_marks` records its identity as unheld; a spawn whose target
  is that file is started by `nish_sb_start` straight from the supervisor,
  with no filter and no listener, though still from the private descriptor
  table, after the identity check, and through `/proc/self/fd/N`. Its
  subtree may exec anything Landlock's EXECUTE allows, which includes the
  ELF loader and `#!` interpreters of every granted program, and the loader
  runs any binary `process.spawn`'s READ_FILE reaches: `exec:git` lets git
  start `ld.so /any/binary`, and lets the Nish program do the same through
  git (`git -c alias.x='!ld.so /any/binary' x`). **Grant it only to a
  dependency that may run anything.** What it does not open: a program
  granted plainly is still held to its one exec, so it cannot start the
  `exec:` program and borrow its reach (the kernel answers its second exec
  `ENOSYS`); the loader named directly is still refused (SBX-1); and a build
  with no `exec:` grant carries no `///` entry, so its IR and its runtime
  behaviour are what they were. The exec allowlist is the program's, not a
  package's, so another dependency granted `process.spawn=<anything>`
  cannot reach the `exec:` program through its own subtree (held), but the
  Nish code of any package with a `process.spawn` grant may spawn it by a
  computed path, since the Nish program's own spawns are checked against
  the allowlist, not against which package made them. A program granted
  both ways is `exec:`; a file marked both as a kept interpreter and as
  `exec:` is refused, the stricter mark winning. The lock file records
  `process.spawn=exec:git` as its own text, so moving a dependency from
  `process.spawn=git` to it is a widening NL2593 reports. "Both ways" is
  decided by file identity, not by path: the runtime looks a spawn target
  up by device and inode, so a second name for the `exec:` program, a
  symlink or a hard link (Debian's `/usr/lib/git-core/git-*` are hard
  links of `git`), granted plainly, is that program and starts unheld. It
  opens nothing a computed path to the `exec:` program does not.
- **What the hold needs, and where it is missing.** A seccomp user
  notification listener (Linux 5.0) and its "continue" answer (5.5). Where
  the filter cannot be installed (`EINVAL` on an older kernel, `EBUSY` where
  an ancestor's filter refuses a listener, `ENOMEM`) or "continue" is
  refused, the spawn is refused: the builtin answers a negative errno or its
  failure value, and one line on stderr says `nish: --sandbox: cannot hold a
  spawned program to one exec, so the spawn is refused (<errno>)`. That is
  so in `--sandbox=best-effort` as well: nothing falls back to an unheld
  spawn. **A refused spawn returns; it does not wait.** The child holds a
  copy of the listener until its exec commits, so closing the supervisor's
  copy would leave a child whose exec was notified and not answered blocked
  in it, and the spawn waiting on that child for good. Where "continue" is
  refused the supervisor therefore answers the same notification with an
  error (`ENOSYS`, an answer every kernel with a listener takes), which
  fails the child's exec; if that answer is refused as well it kills the
  child, reaps it and answers `-ECHILD` itself (there is no child left to
  wait for, and the number tells the two paths apart). A notification gone before
  its answer (`ENOENT`: the child was killed, or a signal restarted its
  exec) sends the supervisor back to wait for the next one or for the
  spawner's answer. Pinned by the two `a spawn whose exec cannot be answered
  "continue" is refused and does not hang` checks below, against a runtime
  built with `-DNISH_SANDBOX_SIMULATE_NO_CONTINUE`. The number the builtin
  answers is not always the errno the line prints, by design: a failed
  `unshare`, `pipe2`, descriptor move or `pthread_create` answers `-EAGAIN`
  and a refused "continue" `-ENOSYS` (`-ECHILD` where the child had to be
  killed), and a failed descriptor move prints `EMFILE`
  whatever `fcntl` said; the line carries the cause. Either `pthread_create`
  failing prints the line with its errno. The hold also needs `unshare(CLONE_FILES)` and `pipe2`, and a
  failure of either prints the same line. **Docker's default seccomp profile
  is such a place**: it allows `unshare` only to a container with
  `CAP_SYS_ADMIN` and answers `EPERM` otherwise (moby's
  `profiles/seccomp/default.json`, read at v27.3.1; `seccomp` and `pipe2` it
  allows), so in a default `docker run` every spawn under an exec allowlist
  is refused with `(EPERM)`. The build still runs and its other confinement
  holds; to spawn there, run the container with a profile that allows
  `unshare` (or `--cap-add SYS_ADMIN`, which is far more than this needs), or
  grant `process.spawn` whole. Any other runtime whose profile denies
  `seccomp(2)` or `unshare(2)` to its payload refuses the same way. Not run
  under Docker by any test.
- **A sandboxed Nish program spawned by one cannot spawn.** The filter
  refuses a second listener because the kernel lets the newest filter's
  "continue" stand for every older one, so a spawned program with a listener
  of its own would answer its children's execs itself. A granted program
  that is itself a `--sandbox` build with an exec allowlist therefore has
  each of its spawns refused (`EBUSY`), where the one-exec hold would refuse
  the exec anyway. Any other program that needs a listener (a container
  runtime, a sandboxing browser) fails the same way when spawned.
- **No other route gives a descendant a listener, or an answer of its
  own.** Read against `kernel/seccomp.c`: a listener comes only from
  `seccomp(2)` with `SECCOMP_FILTER_FLAG_NEW_LISTENER`, whose bit the
  filter tests, so the `TSYNC` with `TSYNC_ESRCH` spelling (flags 25) is
  refused with the plain one (8); `prctl(PR_SET_SECCOMP)` installs with no
  flags and cannot ask for one; the x32 numbers for `seccomp` and `execve`
  are killed by the same head as the process's filter, as is a foreign
  architecture. A descendant may still stack filters without a listener.
  One that answers an exec `ERRNO` or `KILL` outranks `USER_NOTIF` and only
  refuses more; `ALLOW`, `LOG` and `TRACE` rank below it and change nothing;
  one that answers `USER_NOTIF` with no listener of its own gets `ENOSYS`.
  Pinned by `a granted program cannot install a seccomp listener of its
  own` below, for flags 8 and 25.
- **Signals do not reach the helper threads.** Both are created under a
  full mask, restored on the calling thread straight after, and the child
  starts with the caller's mask, not theirs. Without that, a handler chosen
  to run on the supervisor or spawner would act in the private descriptor
  table: `signalFd`'s handler writes one byte to its pipe by number, and in
  the private table a pipe that `signalFd` made on another thread after the
  `unshare` is not there, its number unopened or given to the listener or
  the spawn's pipe, so the program's own wake would be lost or
  the supervisor woken with a byte it reads as the spawner's answer (`-EIO`,
  a refused spawn, never a held-open one). `SIGKILL` and `SIGSTOP` are the
  kernel's and act on the process whole.
- **Who can raise the notification.** The filter is the spawner thread's
  alone, and that thread makes no `execve`: only the child `posix_spawn`
  creates carries it before the listener closes, so the one "continue" goes
  to that child's first exec, of `/proc/self/fd/N`, the file the supervisor
  checked. A child that dies in a redirect before its exec notifies nobody;
  the supervisor is woken by the spawner's pipe instead, closes the listener
  and answers the error.
- **"Continue" trusts the child's memory.** The kernel re-reads the path
  when it continues the call, from the child's memory, which until the exec
  is the Nish process's own (`posix_spawn` clones with `CLONE_VM`). The path
  is `job.proc`, on the stack of the thread that called the builtin, which
  is blocked until the spawn answers; another thread of a memory-safe Nish
  program cannot write there, and no linked C can either: `narrowSandbox`
  emits no exec allowlist for a `main` that reaches `ffi`.
- **What a spawn costs under an exec allowlist.** Two threads created and
  joined, a copy of the descriptor table, a pipe, a filter and two ioctls per
  spawn, beside reading `PATH` to resolve the program (a changed `PATH` can
  only find another file, which is checked the same way) and needing `/proc`
  mounted to exec through `/proc/self/fd/N`. The child is left that
  descriptor (an `O_PATH` one, not close-on-exec, since the `execve` needs
  it); it is opened in the supervisor's private table, so a spawn on another
  thread no longer inherits it. The private table is a copy, though: while a
  spawn is in flight its two threads hold a duplicate of every descriptor the
  process had, so a pipe another thread closes in that window reads
  end-of-file only once the spawn has answered. A `#!` script started this
  way sees `/proc/self/fd/N` as its `$0`. More than 16 marked entries refuses
  every spawn rather than check some of them. All of it is armed whenever the
  build carries an exec allowlist, Landlock or not: under
  `--sandbox=best-effort` on a kernel without Landlock, where exec is
  otherwise not confined, the hold and the refusal still apply.
- **`spawnSyncTo` opens its files in the child.** Its stdout and stderr files
  are opened by the child before the exec, under the sandbox's `fs.write`
  rules: a package granted `process.spawn=<program>` and no write scope that
  holds the file gets `-1` and no program runs. That is Landlock's refusal,
  not the hold's, and it predates it.
- **The allowlist is the build's.** Each program is the realpath the compiler
  found on `PATH` (or from the root package's directory), and its interpreter
  is read from the file then; a program replaced after the build with one
  that needs another interpreter fails to start (`EACCES`), which narrows,
  never widens.
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
- in a spawn under an exec allowlist: `unshare` or `pipe2` failing and the
  "cannot hold" line each prints; a source descriptor of the file actions
  closed by another thread before the supervisor's snapshot (`EBADF`; the
  builtins hand over descriptors they opened or checked themselves, so only
  a racing `fileClose` reaches it); `nish_sb_lift` failing for a pipe end,
  the listener or the target (`EMFILE`); either `pthread_create` failing
  and the "cannot hold" line each prints; `posix_spawnattr_init` failing
  (`ENOMEM`, returned as `posix_spawn`'s error); a signal arriving while a
  spawn is in flight (the two mask checks below show what the child starts
  with, not that no handler ran on a helper: that follows from the mask the
  threads are created under, and no check makes the delivery deterministic);
  the filter refused (`EINVAL`,
  `EBUSY`, `ENOMEM`) and the "cannot hold" line it prints (the nested case
  needs a second sandboxed Nish binary as the granted program); a refused
  "continue" on a real kernel before 5.5 (reached only as the simulated
  refusal); a notification gone before it is read or answered (`ENOENT`: a
  child killed while it waited, or its exec restarted by a signal), after
  which the supervisor polls again and so cannot wait on a child that is
  gone, the spawner's pipe waking it; `poll` failing, which is retried, not
  abandoned (`EINTR` and `ENOMEM` pass; `EFAULT` and `EINVAL` cannot occur,
  the array being the supervisor's own two entries, under any descriptor
  limit that let the listener exist); `NOTIF_RECV` failing other than
  `ENOENT`, which polls again the same way (its argument is a zeroed struct
  of the supervisor's own, so `EFAULT` and `EINVAL` cannot occur); `kill`
  or `waitpid` failing after both answers were refused (the pid is the
  notifying child's, a child of this process no other thread has been told
  of); a short or interrupted read of the spawner's pipe (`-EIO`, and the
  `EINTR` retries of `read`);
- for a `process.spawn=exec:<program>` target: `nish_sb_start` failing on
  the supervisor's own path (its `posix_spawn` error, as the spawner's
  would be); a file marked both as a kept interpreter and as `exec:`, which
  is refused (the compiler writes one mark per program, so only two names
  for one file reach it); and more than 16 marked entries with `exec:`
  ones among them, which refuses every spawn the same as more than 16
  interpreters;
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
- the `sandbox dependency grants` block (`node tests/run.js "sandbox dependency grants"`),
  on `tests/link/sandbox_dep_fs_scoped` and `sandbox_dep_exec_allowlist`,
  each before/after: `sandbox dependency grants: a dependency granted
  fs.read=<dir> reads inside it and not /etc/passwd` (unscoped, the same
  build reads it), `sandbox dependency grants: the wrapper passes the grant's
  real directory as the fs.read scope`, `sandbox dependency grants: a
  dependency granted process.spawn=true runs true and cannot exec echo`
  (without `--sandbox`, it runs `echo`), `sandbox dependency grants: the exec
  allowlist names the granted program by its absolute path`; on
  `sandbox_dep_fs_write_scoped`: `sandbox dependency grants: a dependency
  granted fs.write=<dir> writes inside it and not beside it` (without
  `--sandbox`, it writes beside it; skipped below Landlock ABI 3),
  `sandbox dependency grants: the wrapper passes the grant's real directory
  as the fs.write scope`; and SBX-1's, each before/after against the same
  build without `--sandbox`: `sandbox dependency grants: a granted program's
  ELF loader is refused as a spawn target (SBX-1)`, `sandbox dependency
  grants: a second name for the loader is refused too (SBX-1)`, on
  `sandbox_dep_exec_allowlist`; `sandbox dependency grants: a granted #!
  script runs and its interpreter is refused as a spawn target (SBX-1)`, on
  `sandbox_dep_exec_script`; and `sandbox dependency grants: a program the
  grant names stays spawnable when it is also another's interpreter
  (SBX-1)`, on `sandbox_dep_exec_interpreter_granted`; and its second
  part's, on `sandbox_dep_exec_once` with a helper the check builds and
  grants, which execs its arguments: `sandbox dependency grants: a program
  granted to spawnSync cannot hand the loader an ungranted binary (SBX-1)`
  and the same check for `spawnPiped`, `spawnPipedWithin`, `spawnWithFds`
  and `spawn`, `sandbox dependency grants: a granted program cannot exec
  itself again (SBX-1)`, `sandbox dependency grants: a granted program that
  execs nothing runs as before`, `sandbox dependency grants: a spawn whose
  child dies before its exec answers the error and does not hang (SBX-1)`,
  `sandbox dependency grants: a spawn whose exec cannot be answered
  "continue" is refused and does not hang: the supervisor fails the child's
  exec (SBX-1)` and `... the supervisor kills and reaps the child (SBX-1)`
  (the runtime built with `-DNISH_SANDBOX_SIMULATE_NO_CONTINUE=1` and `=2`;
  a hang ends in the run's timeout and fails the check; the builtin answers
  -38 for the first and -10 for the second),
  `sandbox dependency grants: a granted program cannot install a seccomp
  listener of its own (SBX-1)` (the helper asks `seccomp(2)` for a listener
  with flags 8 and 25 and both answer `EBUSY`, where the unsandboxed control
  answers 0), `sandbox dependency grants: a program granted to spawnSync
  starts with the caller's signal mask (SBX-1)` and the same for `spawn`,
  `sandbox dependency grants: a granted find cannot hand the loader an
  ungranted binary (SBX-1)` and the same for `env`, `sandbox dependency
  grants: a granted program cannot exec another granted program (SBX-1)`,
  `sandbox dependency grants: a program granted exec: starts the loader
  with an ungranted binary, and itself (WP40 §2a)` and the same for a
  program `granted exec: and plainly` (each against the build without
  `--sandbox`, and with the loader named directly still refused),
  `sandbox dependency grants: a program granted plainly beside another's
  exec: grant is held to its one exec (WP40 §2a)`, `sandbox dependency
  grants: a hard link of a program granted exec:, granted plainly, is that
  program and starts unheld (WP40 §2a)`, and
  `sandbox dependency grants: an allowlist with no exec: grant marks
  nothing /// (WP40 §2a)`; on `sandbox_dep_exec_optin`, `sandbox dependency
  grants: env granted exec: runs another granted program (WP40 §2a)`;
  and on `sandbox_dep_exec_once_to`, whose grant adds the write scope the
  child's redirect needs: `sandbox dependency grants: a program granted to
  spawnSyncTo cannot hand the loader an ungranted binary (SBX-1)` (skipped
  below Landlock ABI 3). Each is skipped, and counted, where `clang`, the
  loader or the tool is missing

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
