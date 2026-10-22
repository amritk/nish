# WP42: A multi-core server from pre-forked processes

**Status: the `prefork` stage is built** (`std/net/prefork.ts`,
`examples/prefork-server.ts`, `tests/link/net_prefork*`, and the
`bench/http1-server.ts` `BENCH_CORES` path with its tables in
`bench/README.md`). The anchors below are at `2f5963f`. Where the build
differs from this note:

- `preforkWorkers(args)` and `preforkWith(args, config)` take `process.argv`
  from the caller: a `std/` module compiled on its own has no `main`, and
  `process.argv` needs one. `preforkArgs(args)` answers the arguments without
  the worker flag.
- The flag is the last argument, `--nish-prefork-worker=<index>`, and only a
  last argument of exactly that form counts.
- The supervisor runs `/proc/self/exe` on Linux, `argv[0]` elsewhere (§2.3).
- It answers `PREFORK_SPAWN_FAILED` (-2) when a worker cannot be started,
  after stopping the ones already running, rather than panicking with
  workers left behind, and when it cannot set up its signal handling, before
  any spawn. A bad `PreforkConfig` panics before any spawn.
- A second `SIGTERM` or `SIGINT` during the grace period sends `SIGKILL` at
  once.
- A `NISH_WORKERS` of anything but ASCII digits is ignored; it has no cap.

A Nish server today runs on one core. [WP39](wp39-http-server.md) E1 named
the way out, `SO_REUSEPORT` on TCP, and left its second half, the process that
spawns and supervises the workers, to WP34 N12
([wp34-hosting-cs.md](wp34-hosting-cs.md), the N12 row at `:734`). Issue
[#478](https://github.com/amritk/nish/issues/478) asks for both: a parent that
spawns one child per core, each listening on the same port, that restarts a
child that dies and shuts down cleanly on `SIGTERM`.

This note records the choice behind that design — processes rather than
threads — and the API, the platforms, the security questions and the stages
that follow from it. The stages that build it follow this note where the two
differ from the plan that scheduled them.

## 1. The choice: processes, not threads

A multi-core server can be one process with a thread per core, or one process
per core. On the four axes that matter here, Nish answers for processes.

**What the checker allows.** No `nish:net` call may run in a `scope()` task or
a `parallel` body. Every one counts as a write to the kernel's state of a
socket (`src/runtime.ts:585`), every net export (`isNetExport`,
`src/nish-modules.ts:246`) is checked as one (`src/builtins.ts:1024-1025`),
and the parallel
checker refuses a task that writes memory its caller can see "in the runtime's
`…`" (`src/parallel.ts:451`). `docs/LANGUAGE.md:6922` states the rule, and six
cases pin it: `reject_net_task`, `reject_net_udp_task`, `reject_net_poll_task`,
`reject_net_parallel`, `reject_net_udp_parallel` and
`reject_net_poll_parallel`. A thread per core would have to lift that rule. A
process per core needs no change to the checker at all: each worker is an
ordinary single-threaded program.

**The threads there are.** `std/threads` gives scoped, join-bounded tasks and
nothing else: `scope()` (`std/threads.ts:338`) is a `using` binding, and "a
task runs when its scope joins, not when it is spawned"
(`docs/LANGUAGE.md:3234`). A server's accept loop runs until the process is
told to stop, so it would need a detached, long-lived thread, which the
language does not have.

**Crash isolation.** A panic, an `expect` and a failed range entry call
`exit(1)`; a failed check and out of memory call `_exit(1)`
(`runtime/runtime.c:97-99`, `nish_panic` at `:348-351`, `nish_oom` at `:131`).
Either ends the whole process, every thread with it. In one process, a bad
request that panics one worker takes every connection on every core down. In a
pre-forked server it takes one worker's connections, and the supervisor starts
another.

**Memory and shared state.** Each worker thread of `std/threads` has its own
arena already (`std/threads.ts:38`; the per-worker arenas at
`runtime/runtime-parallel.c:249-268`), so threads would save little memory
over processes: the code pages are shared by the kernel either way. What
threads would add is state shared between workers, and a server that keeps no
state between requests, as a TechEmpower entry and most HTTP services do,
wants none. A cache shared across cores is out of scope here (§6).

**What a thread design would have to say first.** #478 calls a socket handed
to a `scope()` task "worth a design note if it is ever wanted", and WP39 §6
lists it as needing "an ownership rule for descriptors". That rule would have
to state three things, none of which exists:

- a descriptor is **moved** into exactly one task, not shared, so no two
  threads read or write one socket, and the parent may not touch it after the
  move;
- the task may **outlive** the scope's join, which is the detached thread
  `std/threads` does not have, or the scope must never join while the server
  runs, which blocks the parent;
- each task **owns its own poll loop** (`pollCreate`), since a loop that
  several threads wait on is shared kernel state of exactly the kind the
  checker refuses.

Processes give all three for free, which is the reason for the choice.

## 2. The API

The prefork stage puts this in `std/net/prefork.ts`. The names are the plan's;
the stage may refine the signatures.

### 2.1 The socket: `tcpListenFlags`

Each worker opens its own listening socket with
`tcpListenFlags(host, port, backlog, flags)`. Flag 1 sets `SO_REUSEPORT`;
any other bit answers -22, as `udpBind`'s flags do (`runtime/runtime-net.c:347`,
`(uint32_t)flags > 3`). `tcpListen(host, port, backlog)` keeps its signature
(`src/nish-modules.ts:152`; `runtime/runtime-net.c:235`), so no program that
calls it changes. UDP already has the flag: `udpBind`'s bit 1 sets
`SO_REUSEPORT` (`runtime/runtime-net.c:216`) in the datagram branch of the
bind. The stream branch above it sets `SO_REUSEADDR` instead (`:213-214`), so a
TCP socket has `SO_REUSEADDR` and no `SO_REUSEPORT` today, and a UDP socket
the reverse; `tcpListenFlags`' bit 1 adds `SO_REUSEPORT` to the stream branch
beside the `SO_REUSEADDR` it keeps.

The parent never opens the socket. It cannot hand one down anyway: every
socket is created close-on-exec (`runtime/runtime-net.c:158`, `SOCK_NONBLOCK |
SOCK_CLOEXEC` on Linux, `FD_CLOEXEC` on Darwin at `:147`), and so is every
accepted one (`:273`). A worker that opens its own socket needs no descriptor
passing, and a worker the supervisor restarts binds again on its own.

### 2.2 The process builtins: WP34 N12

Four builtins join `nish:process` (whose exports today are listed at
`src/nish-modules.ts:121`), in `runtime/runtime-os.c`:

| Builtin | Answers |
| --- | --- |
| `spawn(argv: string[]): i32` | the child's pid, or a negative errno. It does not wait. |
| `waitPid(pid: i32, flags: i32): i32[]` | `[pid, status]`, with `status` in `spawnSync`'s convention (the exit code, or 128 + the signal); `pid` -1 waits for any child, flag 1 is `WNOHANG`, and `[0, 0]` means a child remains but none has exited yet. A failure puts the negative errno in the first element: `[-10, 0]` (`-ECHILD`) means no child remains, so every worker is reaped, and `[-4, 0]` (`-EINTR`) means a signal cut the wait short and the call is repeated. |
| `kill(pid: i32, sig: i32): i32` | 0 or a negative errno; `sig` is 0, 2, 9 or 15, and anything else is -22. |
| `availableParallelism(): i32` | the cores this process may use. |

`totalMemory(): i64` completes N12 but prefork does not need it.

`spawn` is `spawnSync` without its wait. `nish_spawn_impl`
(`runtime/runtime-os.c:214-263`) calls `posix_spawnp` (`:258`) and then
blocks in `waitpid` (`:261`); `spawn` returns at `:258`, and `waitPid` is the
`waitpid` and the 128 + `WTERMSIG` conversion (`:262`) on their own.

`availableParallelism` is `nish_cpu_count` (`runtime/runtime-parallel.c:134`):
the smallest of the CPUs online, the affinity mask `taskset` and a cpuset set,
the cgroup v2 quota, and `NISH_NUM_THREADS`, which can lower the count and
never raise it (`:128-133`). Without `--threads` the function answers 1
(`:155`), because it was written for the parallel runtime; N12 moves the count
out from under that guard so a single-threaded supervisor gets the real
number.

The rolling freeze applies: `std/`, `bench/`, `examples/` and `tests/` may call
these builtins as soon as they land, and `src/` only from the release that
ships them.

### 2.3 The supervisor

```ts
import { tcpListenFlags } from "nish:net"
import { preforkWorkers } from "nish/net/prefork"

// In the parent, preforkWorkers spawns the workers and supervises them, and
// returns only when they have all exited. In a worker it returns that
// worker's index at once.
const worker = preforkWorkers(process.argv)
const listener = tcpListenFlags("0.0.0.0", 8080, 1024, 1)
// … the single-core server, unchanged …
```

`preforkWorkers(process.argv)` decides which process it is in from its argv: the
supervisor spawns each worker as `argv[0]` with the worker's index appended
as a flag. N12's `spawn` takes an argv only, and the child inherits the
parent's whole environment (`posix_spawnp` is passed `environ`,
`runtime/runtime-os.c:258`), so argv is where the index goes; an environment
variable would need a knob `spawn` does not have.

`argv[0]` is the path the program was started by. `posix_spawnp` searches
`PATH` for a bare name, and a relative path resolves against the working
directory, so the supervisor does not `chdir` before it has spawned. Linux has
`/proc/self/exe` as a firmer answer; the stage may use it there.

The supervisor:

1. reads N: `NISH_WORKERS` when it is a positive number, otherwise
   `availableParallelism()`;
2. calls `signalFd()` **before** it spawns, so a `SIGTERM` that arrives during
   start-up is heard;
3. spawns N workers;
4. loops on `pollWait` over the signal descriptor with a timeout, and on each
   tick reaps with `waitPid(-1, 1)` until it answers `[0, 0]` (none ready
   yet) or `-ECHILD` (none left), repeating it on `-EINTR`;
5. restarts a worker that exited, at the same index, with a backoff when it
   crash-loops: a worker that dies within a second of its start waits twice
   as long as the last one before its restart, up to a cap, and a worker that
   ran longer resets its delay;
6. on `SIGTERM` or `SIGINT`, stops restarting, sends `SIGTERM` to every
   live worker, reaps them until a deadline, then sends `SIGKILL` to those
   left and reaps those too, and returns.

### 2.4 Signals

`signalFd` hears `SIGINT` and `SIGTERM` only: the handler is installed for
those two (`runtime/runtime-host.c:209-210`). It does not hear `SIGCHLD`, and
adding it is out of scope (§6), so the supervisor finds a dead worker by the
`waitPid` on its timeout tick rather than by a signal. A worker that dies is
noticed within one tick; the stage picks the tick (100 ms is a fair start).

The descriptor is a pipe a C handler writes to, not a Linux `signalfd`, and
for a reason that matters here: a handler is reset to the default by `exec`,
so a worker starts with `SIGTERM`'s default action and nothing blocked
(`runtime/runtime-host.c:144-154`). A worker that does nothing about signals
dies on the supervisor's `SIGTERM`, which is the clean shutdown for a server
that keeps no state. A worker that wants to drain its connections first calls
`signalFd()` itself.

A terminal's Ctrl-C sends `SIGINT` to the whole foreground process group,
workers included. The workers therefore get `SIGINT` from the terminal at the
same moment the supervisor does, and the supervisor's shutdown then finds
them already exiting. Under a service manager, which signals the main pid
only, the supervisor's forwarding is what reaches them.

## 3. Platforms

**Linux** (3.9 and later) hashes each new connection across every socket
bound to the port with `SO_REUSEPORT`, so the kernel spreads the load. Every
socket in the group must belong to the same effective uid, which the workers
of one supervisor do. The spread is a hash of the connection's 4-tuple, not a
round robin, so a handful of connections can land lopsided: the link test
asserts that at least two workers answered, never an even split. Connections
already queued on a worker's listener when that worker dies are reset, not
handed to its siblings; moving them needs `net.ipv4.tcp_migrate_req`
(Linux 5.14 and later), which the supervisor does not set.

**Darwin** accepts `SO_REUSEPORT` and lets several sockets bind the port, but
does not spread connections between them: one socket takes them all. Prefork
on Darwin therefore runs, and every worker binds, but one worker serves.
`preforkWorkers` defaults to one worker there, so the default does not spawn
idle processes; `NISH_WORKERS` still sets more, for a program that wants the
supervisor's restart and shutdown rather than the spread. The link test for
spread runs on Linux only.

**wasm32 and WASI** have no sockets and no processes. Every `nish:net` call
is refused at compile time under a wasm target with NL2404
(`docs/LANGUAGE.md:6928-6932`, through `refuseOnWasm` at `src/builtins.ts:89`), and
the N12 builtins join the same refusal.

## 4. Security

**Who may join the port.** On Linux, another process of the same effective uid
that binds the port with `SO_REUSEPORT` joins the group and takes a share of
the connections. That is the kernel's rule, not Nish's, and it means a server
using flag 1 trusts every program its user runs. A server that needs more
runs under a uid of its own. The tcp-reuseport stage records this in
`docs/security/runtime.md` as RT-17.

**What a worker inherits.** Descriptors: none of the parent's sockets, its
accepted connections or its signal pipe, since each is close-on-exec
(§2.1; `runtime/runtime-host.c:186-195`, with Darwin's window between `pipe`
and `fcntl` noted at `:190-191`), and the files the runtime opens are
`O_CLOEXEC` (RT-12, fixed). Environment: all of it, because `posix_spawnp` is
passed `environ` (`runtime/runtime-os.c:258`); a secret in the supervisor's
environment is in every worker's. Signals: default dispositions, as §2.4
says.

**Restart storms.** A worker that crashes at start-up would be
restarted in a tight loop; the backoff in §2.3 bounds that, and the prefork
stage pins it with a link test.

## 5. Stages

| Stage | What it builds |
| --- | --- |
| `tcp-reuseport` | `tcpListenFlags(host, port, backlog, flags)` in `nish:net`, flag 1 `SO_REUSEPORT`; RT-17 |
| `wp42-note` | this note |
| `bench-cores` | `bench/http.mjs --cores 1,2,4`, and each twin reading `BENCH_CORES` |
| `process-n12` | `spawn`, `kill`, `waitPid`, `availableParallelism` and `totalMemory` in `nish:process` |
| `prefork` | `std/net/prefork.ts`, `examples/prefork-server.ts`, and link tests for the spread, a dead worker, `SIGTERM`, a flat arena per worker and the crash-loop backoff |
| `bench-measure` | `bench/http1-server.ts` reads `BENCH_CORES`; `bench/README.md` gets tables at 1, 2 and 4 cores |

**The bench's method.** Today `bench/http.mjs` pins each server to CPU 0
through `taskset -c 0` (`bench/http.mjs:112-119`), and the twins are held to
one core: `GOMAXPROCS=1` and `workers(1)` (`bench/http-twins/README.md:53-56`,
`bench/http-twins/rust-actix/src/main.rs:59`). At N cores the server runs
under `taskset -c 0-(N-1)` and `wrk` on the cores left, with up to four
threads; where the client has no core of its own, the table's header says
"client shares server cores". Each twin takes N its own way: `GOMAXPROCS` for
both Go twins, `worker_processes` for nginx, N `reusePort` processes for Bun,
`workers(N)` for actix and a multi-threaded tokio runtime for hyper. node-http
and uWS stay single-core and read `n/a (single-core)`. Every figure is read
against the noise band of a byte-identical copy of the Nish server timed in
the same interleaved rounds.

## 6. Not in this work package, on purpose

- A socket handed to a `scope()` task: the ownership rule of §1 comes first.
- State shared between workers.
- Hot reload, or a rolling restart that keeps the port open.
- `SIGCHLD` in `signalFd`.
- A change to `tcpListen`'s signature.
