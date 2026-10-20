---
name: Multi-core HTTP server — SO_REUSEPORT on TCP, a pre-fork supervisor, and a bench at 1, 2 and 4 cores (#478)
overview: A Nish server uses one core, and the bench hides it by pinning every server to CPU 0. This adds tcpListenFlags with SO_REUSEPORT, the WP34 N12 process builtins (spawn, kill, waitPid, availableParallelism, totalMemory), a std/net/prefork supervisor that runs one worker process per core and restarts the ones that die, and a bench mode that gives every twin the same N cores.
stages:
  - id: tcp-reuseport
    title: feat(net) — tcpListenFlags, SO_REUSEPORT on a TCP listener
    goal: Ship tcpListenFlags(host, port, backlog, flags) in nish:net, flag 1 setting SO_REUSEPORT before bind, any other bit -22, refused on wasm32 with NL2404, tcpListen unchanged
    verification: npm run check, npm run lint, node tests/run.js net_, node tests/run.js wasi (its skip line read), node tests/run.js performance, then an undegraded npm test
    status: pending
    todos:
      - id: s1-builtin
        content: Add tcpListenFlags to the nish:net export list and netSignature in src/nish-modules.ts, its declare in src/runtime.ts, and the twins in runtime/nish.h, runtime/nish.d.ts, runtime/nish.mjs and runtime/shim.mjs — see tcpListenFlags, Surface
        status: pending
      - id: s1-runtime
        content: Implement nish_tcp_listen_flags in runtime/runtime-net.c through nish_net_bound, and raise NET_TEXT_BUDGET in tests/runtime-budgets.js with the measurement beside it and its row in docs/wp7-runtime.md — see tcpListenFlags, Runtime
        status: pending
      - id: s1-tests
        content: Add tests/cases/net_tcp_reuseport (two listeners on one port, flags 2, 4 and -1 giving -22), reject_net_reuseport_wasm, a tests/runtime-test.c case, and a tests/link/net_tcp_reuseport_spread case that shows loopback connections accepted on both listeners — see tcpListenFlags, Tests
        status: pending
      - id: s1-docs
        content: Write the LANGUAGE.md rule with the per-platform table, the IR_COOKBOOK entry and cookbook program, the regenerated runtime prelude, docs/AI.md, a new docs/guide/using-nish/networking.md page with its scalar.config.json route, the wp35 net row and RT-17 in docs/security/runtime.md — see tcpListenFlags, Docs
        status: pending
      - id: s1-goldens
        content: Register the new cases (tests/differential/goldens.js --update, tests/nish-cmp.js DECLARED entries) and regenerate tests/self/goldens with node tests/self/goldens.js --update — see Generated files
        status: pending
  - id: wp42-note
    title: docs — WP42, the multi-core server design note
    goal: Record why the multi-core server is pre-forked processes rather than threads, and fix the std/net/prefork API and its platform behaviour before it is built
    verification: node docs/check-links.mjs and npm run lint pass; node tests/run.js docs passes
    status: pending
    todos:
      - id: s2-note
        content: Write docs/wp42-multicore-server.md in the wp39 header form — the choice, its reasons, the prefork API, Darwin, signals, and the stages — see WP42, What the note says
        status: pending
      - id: s2-index
        content: Add WP42 rows to docs/README.md and docs/MASTER_PLAN.md — see WP42, What the note says
        status: pending
  - id: bench-cores
    title: test(bench) — a --cores mode for bench/http.mjs and N-core twins
    goal: bench/http.mjs --cores 1,2,4 pins each server to cores 0..N-1 and wrk to the rest, passes BENCH_CORES=N to every server, and every twin that can use N cores is configured to use exactly N
    verification: node bench/http.mjs --help prints --cores; bash bench/http-twins/run.sh --cores 1,2 --rounds 1 --duration 1 completes and prints a table per core count; npm run lint passes
    status: pending
    todos:
      - id: s3-harness
        content: Add --cores to bench/http.mjs — the pinning layout, BENCH_CORES in each server's environment, one table per core count with the header naming the cores — see Bench harness
        status: pending
      - id: s3-twins
        content: Read BENCH_CORES in each twin under bench/http-twins (GOMAXPROCS for both Go twins, worker_processes for nginx, N reusePort processes for Bun, workers(N) for actix, worker threads for hyper) and mark node-http and uws single-core — see Bench harness, Twins
        status: pending
      - id: s3-run
        content: Pass --cores through bench/http-twins/run.sh and its README — see Bench harness
        status: pending
  - id: process-n12
    title: feat(runtime) — non-blocking spawn, kill, waitPid, availableParallelism and totalMemory (WP34 N12)
    goal: The nish:process builtins a supervisor needs, each with its capability row, its wasm32 refusal, its Node twin and its goldens
    verification: npm run check, npm run lint, node tests/run.js os_host, node tests/run.js capabilities, node tests/run.js wasi (skip line read), node tests/run.js performance, then an undegraded npm test
    status: pending
    todos:
      - id: s4-builtins
        content: Add spawn, kill, waitPid, availableParallelism and totalMemory to nish:process across src/nish-modules.ts, src/builtins.ts, src/emit-builtins.ts, src/runtime.ts, src/capabilities.ts and the runtime twins — see N12, Surface
        status: pending
      - id: s4-runtime
        content: Implement them in runtime/runtime-os.c (availableParallelism over nish_cpu_count) with Linux and Darwin branches, raising that unit's ceiling in tests/runtime-budgets.js with the measurement — see N12, Runtime
        status: pending
      - id: s4-tests
        content: Add golden cases for each builtin, an invalid signal and an unknown pid returning their errors, a reject case per builtin on wasm32, and a tests/link case that spawns, kills and reaps a child — see N12, Tests
        status: pending
      - id: s4-docs
        content: Write the LANGUAGE.md rules, cookbook entry, regenerated runtime prelude, docs/AI.md, the guide's nish:process section, the wp34 N12 row and the wp35 capability rows — see N12, Docs
        status: pending
      - id: s4-goldens
        content: Register the cases and regenerate tests/self/goldens — see Generated files
        status: pending
  - id: prefork
    title: feat(net) — std/net/prefork, a supervisor that runs one worker per core
    goal: A Nish program serves one port from N worker processes, the supervisor restarts a worker that dies, and SIGTERM shuts every worker down cleanly through signalFd
    verification: node tests/run.js net_prefork passes every case, npm run check and npm run lint pass, then an undegraded npm test
    status: pending
    todos:
      - id: s5-module
        content: Write std/net/prefork.ts to WP42's API — see Prefork, The module
        status: pending
      - id: s5-example
        content: Write examples/prefork-server.ts, a child per core on one TCP and one UDP port, from #478's acceptance — see Prefork, The example
        status: pending
      - id: s5-link-tests
        content: Add tests/link/net_prefork_* cases for the spread across workers, a killed worker leaving the others serving and being restarted, a clean SIGTERM, and a flat arena in every worker — see Prefork, Tests
        status: pending
      - id: s5-docs
        content: Document std/net/prefork in docs/guide/using-nish/networking.md and standard-library.md, docs/AI.md, and add the socket-sharing rows to docs/security — see Prefork, Docs
        status: pending
      - id: s5-goldens
        content: Regenerate tests/self/goldens and the link goldens the new cases add — see Generated files
        status: pending
  - id: bench-measure
    title: perf(bench) — the nish server on N cores, measured at 1, 2 and 4
    goal: bench/http1-server.ts runs BENCH_CORES workers through std/net/prefork, and bench/README.md records req/s at 1, 2 and 4 cores for nish, nish-copy and every N-core twin
    verification: bash bench/http-twins/run.sh --cores 1,2,4 completes with nish and nish-copy byte-identical; npm run lint and node docs/check-links.mjs pass; npm test compiles bench/http1-server.ts
    status: pending
    todos:
      - id: s6-server
        content: Make bench/http1-server.ts read BENCH_CORES and serve through std/net/prefork, one worker when it is unset — see Bench measurement
        status: pending
      - id: s6-measure
        content: Run the bench at 1, 2 and 4 cores and record the tables, the machine, the core layout and the nish-copy band in bench/README.md — see Bench measurement
        status: pending
---

## Context

A Nish server uses one core ([#478](https://github.com/amritk/nish/issues/478)). [bench/http.mjs](../../bench/http.mjs) starts every server under `taskset -c 0`, and each twin is configured for one core (`GOMAXPROCS=1`, `worker_processes 1`, `workers(1)`), so the gap never shows. Deployed, those servers use every core.

Facts this plan rests on:

- `tcpListen(host, port, backlog)` is `"sii"` in `netSignature` ([src/nish-modules.ts](../../src/nish-modules.ts):152) and reaches `nish_net_bound` ([runtime/runtime-net.c](../../runtime/runtime-net.c):194-241), whose stream branch sets only `SO_REUSEADDR`. `udpBind` sets `SO_REUSEPORT` for flag 1 (:216) and returns -22 for any bit above 3 (:347).
- A new `nish:net` export inherits `CAP_NET` (`isNetExport`, [src/capabilities.ts](../../src/capabilities.ts):240) and the wasm32 refusal NL2404 (`checkNet` → `refuseOnWasm`, [src/builtins.ts](../../src/builtins.ts):1040). `runtime-net.c` is an empty unit under `__wasi__`/`__wasm__`.
- `NET_TEXT_BUDGET` is 2304 against a measured 2303 ([tests/runtime-budgets.js](../../tests/runtime-budgets.js):313). Any C added to the unit raises it.
- The checker refuses every `nish:net` call reachable from a `scope()` task or a parallel body, through the effect analysis (`tests/cases/reject_net_task`, `reject_net_parallel`, LANGUAGE.md "Types, threads and wasm"). No thread can own a socket today.
- N12 (wp34 §8) is unbuilt: there is no non-blocking `spawn`, `kill`, `waitPid` or total memory, and `nish_cpu_count` exists in C ([runtime/runtime-parallel.c](../../runtime/runtime-parallel.c):134) but not as a builtin. `signalFd` exists, for SIGTERM and SIGINT only.

## Approach

**Processes, not threads.** Stage `wp42-note` records the reasons. In short: threads need a descriptor-ownership rule the checker does not have, and #478 and WP39 §6 put that rule out of scope. `std/threads` also guarantees only scoped, join-bounded tasks, with no long-lived detached thread. With processes, one worker's panic or out-of-memory kill leaves the others serving. Each worker has its own arena, and the workers share no state, which is what a pre-fork HTTP server wants. Shared state across workers is out of scope.

**A sibling, not a new argument.** `tcpListen` keeps its signature (LANGUAGE.md's stability rule). `tcpListenFlags` follows `udpBind`'s convention: flags are an `i32`, checked at run time, and an unknown bit is `-22`, so the flag can be a variable.

**Rolling freeze.** `src/` never calls `tcpListenFlags` or the N12 builtins. `std/`, `bench/`, `examples/` and `tests/` may, because stage1 compiles them.

**Order.** Stages 1 and 4 share a dozen files (`src/runtime.ts`, `runtime/nish.h`, LANGUAGE.md, the cookbook prelude, the goldens), so they run one after the other. Stage 2 (doc only) and stage 3 (bench harness and twins) run beside stage 1.

| stage | owns | starts after | merges after |
|---|---|---|---|
| tcp-reuseport | net surface, runtime-net.c, shared docs and goldens | — | — |
| wp42-note | `docs/wp42-*.md`, `docs/README.md`, `docs/MASTER_PLAN.md` | — | — |
| bench-cores | `bench/http.mjs`, `bench/http-twins/**` | — | — |
| process-n12 | process surface, runtime-os.c, shared docs and goldens | tcp-reuseport merged | tcp-reuseport |
| prefork | `std/net/prefork.ts`, the example, link tests, guide, security | process-n12 and wp42-note merged | process-n12, wp42-note |
| bench-measure | `bench/http1-server.ts`, `bench/README.md` | prefork and bench-cores merged | prefork, bench-cores |

## tcpListenFlags

**Owns:** `src/nish-modules.ts`, `src/runtime.ts`, `runtime/runtime-net.c`, `runtime/nish.h`, `runtime/nish.d.ts`, `runtime/nish.mjs`, `runtime/shim.mjs`, `tests/runtime-test.c`, `tests/runtime-budgets.js`, `tests/cases/net_tcp_reuseport*`, `tests/cases/reject_net_reuseport*`, `tests/link/net_tcp_reuseport*/**`, `tests/nish-cmp.js`, `tests/differential/goldens/**`, `tests/self/goldens/**`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/AI.md`, `docs/wp7-runtime.md`, `docs/wp35-capabilities.md`, `docs/security/runtime.md`, `docs/guide/using-nish/networking.md`, `docs/guide/using-nish/standard-library.md`, `docs/guide/language/modules.md`, `scalar.config.json`

### Surface

```ts
// nish:net
tcpListenFlags(host: string, port: i32, backlog: i32, flags: i32): i32
// flag 1: SO_REUSEPORT. Any other bit: -22. Otherwise as tcpListen.
```

`netSignature` row `"siii"`; `netSymbol` gives `nish_tcp_listen_flags`. Update the hand-kept export list (`src/nish-modules.ts`:124), LANGUAGE.md's count of `nish:net` functions, and wp35's `net` row.

### Runtime

`nish_tcp_listen_flags` validates `(uint32_t)flags > 1 → -22`, then shares `nish_net_bound`'s path with `SO_REUSEPORT` set before `bind` when bit 1 is on. `tcpListen` keeps its behaviour. Platforms, stated in LANGUAGE.md as a table:

| platform | flag 1 |
|---|---|
| Linux ≥ 3.9 | Every socket bound with it shares the port, and the kernel hashes each new connection to one of them, so load spreads. All sockets must have the same effective uid. |
| Darwin | Binding succeeds and the port is shared, but the kernel does not spread connections: one socket receives them. A pre-fork server there runs with no balancing. |
| wasm32 / `--profile wasi` | Refused at compile time, NL2404. |

`--profile wasm` links host IR freestanding. A host-compiled call to `nish_tcp_listen_flags` there must fail in the same way `tcpListen` does today. Check this and pin it in a test, or say in the PR which route already refuses it (CLAUDE.md, wasm32 guard).

### Tests

- `tests/cases/net_tcp_reuseport.ts` + `.ll` + `.out`:
  - two `tcpListenFlags(…, 1)` on the same port both succeed;
  - a second plain `tcpListen` on that port fails;
  - flags 2, 4 and -1 give -22.
- `tests/cases/reject_net_reuseport_wasm` (`--target wasm32`), whose `.err` holds NL2404's exact text for `tcpListenFlags`.
- A `tests/runtime-test.c` case for the C entry.
- `tests/link/net_tcp_reuseport_spread/`: one process, two shared listeners on one loopback port, 64 connects, then accept on both through `pollWait`. It prints that each listener accepted at least one connection. Gate it on Linux, and on Darwin print the documented single-socket behaviour instead.

### Docs

- The LANGUAGE.md row and platform table in "The client half"/listener table.
- The `docs/IR_COOKBOOK.md` entry and a `docs/cookbook/` program.
- `docs/cookbook/regen.sh` for the runtime prelude.
- `docs/AI.md`'s sockets paragraph.
- A new `docs/guide/using-nish/networking.md`, the guide's `nish:net` page: listeners, the readiness loop, and sharing a port. Add its route in `scalar.config.json` and links from `modules.md` and `standard-library.md`.
- **RT-17** in `docs/security/runtime.md`: socket sharing. Any process of the same uid can bind the port with `SO_REUSEPORT` and receive a share of its connections, so a deployer who shares a host with another service of that uid gives it the traffic. A listener made with `tcpListen` refuses a second bind. Name the tests in its Tests list by their exact `check(...)` strings.

## WP42

**Owns:** `docs/wp42-multicore-server.md`, `docs/README.md`, `docs/MASTER_PLAN.md`

### What the note says

- The header follows wp39's form: the title, a `**Status:**` line, and the commit its anchors are at.
- **§1 The choice and its reasons.** Compare threads with processes on four axes, citing the checker rule and `std/threads`'s guarantees: crash isolation, shared state, what the checker allows, and memory. A thread design would need a descriptor-ownership rule, and the note names what that rule would have to say, so it is on record if ever wanted.
- **§2 The API** that stage 5 builds, as a sketch:
  - `preforkWorkers()`: N = `availableParallelism()` unless `NISH_WORKERS` sets it.
  - The supervisor loop: `spawn` each worker with its index in its environment or argv, then `pollWait` on `signalFd` with a timeout, and `waitPid(-1, WNOHANG)` on each tick.
  - A worker that dies is restarted, with a backoff when it crash-loops.
  - SIGTERM is forwarded to every child, and the parent reaps them with a deadline, then SIGKILL.
  - A worker sees which index it is and listens with `tcpListenFlags(…, 1)` itself; the parent never opens the socket.
- **§3 Platforms.** Linux spreads the connections; Darwin does not, and the note says what prefork does there. wasm32 refuses it.
- **§4 Security.** Socket sharing (RT-17), and what a worker inherits from the parent's environment and descriptors.
- **§5 Stages**: this plan's three implementation stages, with the bench's method.

## Bench harness

**Owns:** `bench/http.mjs`, `bench/http-twins/**`

- `--cores 1,2,4` runs every scenario once per core count. For N cores:
  - the server runs under `taskset -c 0-(N-1)`;
  - wrk runs under `taskset -c N-(cpus-1)`, with `-t` as many threads as there are client cores, capped at 4.
  - Each server gets `BENCH_CORES=N` in its environment. Its absence means today's one-core layout, so `--cores` left off reproduces today's tables exactly.
- When `cpus - N < 1`, the client shares the server's cores. The header then says so (`client shares server cores`), and the cell gets a note. It is never a silent overlap.
- The CPU, user and RSS columns sum over the server's whole process tree (children included), so a pre-fork server's workers are counted.
- **Twins.** Each reads `BENCH_CORES` and gets the same N:

  | twin | setting |
  |---|---|
  | go-nethttp, go-fasthttp | `GOMAXPROCS` |
  | nginx | `worker_processes`, with the master process on when N > 1 |
  | bun | N processes with `reusePort: true` |
  | rust-actix | `workers(N)` |
  | rust-hyper | a multi-thread tokio runtime with N workers |
  | node-http, uws | one core; their cells beyond N=1 read `n/a (single-core)`, unless a twin's README shows a stock N-process mode, in which case use it and say so |

- `run.sh` passes `--cores` through. The twins README gets a table of each twin's setting.

## N12

**Owns:** `src/nish-modules.ts`, `src/builtins.ts`, `src/emit-builtins.ts`, `src/emit-util.ts`, `src/runtime.ts`, `src/capabilities.ts`, `src/codes.ts`, `runtime/runtime-os.c`, `runtime/nish.h`, `runtime/nish.d.ts`, `runtime/nish.mjs`, `runtime/shim.mjs`, `tests/runtime-test.c`, `tests/runtime-budgets.js`, `tests/cases/os_spawn*`, `tests/cases/os_kill*`, `tests/cases/os_wait*`, `tests/cases/os_cpu*`, `tests/cases/os_memory*`, `tests/cases/reject_os_*`, `tests/cases/caps_*`, `tests/link/os_spawn*/**`, `tests/nish-cmp.js`, `tests/capabilities.js`, `tests/differential/goldens/**`, `tests/self/goldens/**`, `docs/LANGUAGE.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/AI.md`, `docs/wp7-runtime.md`, `docs/wp34-hosting-cs.md`, `docs/wp35-capabilities.md`, `docs/wp36-capability-policy.md`, `docs/security/runtime.md`, `docs/guide/using-nish/standard-library.md`

### Surface

```ts
// nish:process
spawn(argv: string[]): i32            // child pid, or a negative errno; never waits
kill(pid: i32, signal: i32): i32      // 0, or a negative errno; signal is 0, 2, 9 or 15, any other -22
waitPid(pid: i32, flags: i32): i32[]  // [pid, status] or [0, 0] under flag 1 (WNOHANG) with no child done; pid -1 for any child
availableParallelism(): i32           // nish_cpu_count(), at least 1
totalMemory(): i64                    // bytes of physical memory, or -1
```

`status` uses `spawnSync`'s convention (the exit code, `128 + n` for a signal). The worker may change these shapes only to fit what the checker can already type, such as an out-array in place of a returned `i32[]`. It records any change in the PR body and in LANGUAGE.md.

- **Capabilities:** `spawn`, `kill` and `waitPid` take `spawnSync`'s row. `availableParallelism` and `totalMemory` take the row that `platform` and `arch` carry, or a deliberate `CAP_NONE`, with the reason in `src/capabilities.ts`.
- **wasm32:** each builtin is refused, with NL2404's wording or the code `spawnSync` uses there today.

### Runtime

- In `runtime/runtime-os.c`: `posix_spawnp` without the wait, `kill`, and `waitpid` with `WNOHANG` mapped from flag 1.
- `totalMemory` reads `sysconf(_SC_PHYS_PAGES) * _SC_PAGESIZE` on Linux and `sysctl hw.memsize` on Darwin.
- `availableParallelism` calls `nish_cpu_count` (runtime-parallel.c), and the program does not need `--threads` for it. If the link cannot reach that unit without `--threads`, move the reading into runtime-os.c behind a shared helper. Do not duplicate it.
- Raise the touched units' ceilings in `tests/runtime-budgets.js`, with the measurement beside each and their rows in `docs/wp7-runtime.md`.

### Tests

- Golden cases for each builtin, with `.ll` and `.out`.
- A child spawned with `spawn` runs while the parent continues, then is reaped with its status.
- `kill(pid, 15)` on a sleeping child, then `waitPid`, gives `128 + 15`.
- `kill` with signal 7 gives -22, and a pid with no process gives `-3` (ESRCH).
- `waitPid(-1, 1)` with no finished child gives `[0, 0]`.
- `availableParallelism() >= 1`, and `totalMemory() > 0`.
- A reject case per builtin on wasm32, with its exact `.err`.
- The capability goldens (`caps_*`), and `tests/capabilities.js` green.

### Docs

- LANGUAGE.md's `nish:process` rules.
- The cookbook entry and the regenerated prelude.
- `docs/AI.md`.
- The guide's process section in `standard-library.md`.
- N12's row in `docs/wp34-hosting-cs.md` marked built.
- wp35 and wp36's capability rows.
- An RT row for `kill`: it signals any process of the same uid, not only the program's own children.

## Prefork

**Owns:** `std/net/prefork.ts`, `examples/prefork-server.ts`, `tests/link/net_prefork*/**`, `tests/cases/std_prefork*`, `tests/self/goldens/**`, `tests/differential/goldens/**`, `docs/guide/using-nish/networking.md`, `docs/guide/using-nish/standard-library.md`, `docs/AI.md`, `docs/LANGUAGE.md` (only the std-module table row, if it has one), `docs/security/runtime.md`, `docs/security/http1.md`, `docs/security/README.md`

### The module

`std/net/prefork.ts` implements WP42 §2 as merged. Where the note and this plan differ, the note wins, because it is the reviewed design.

### The example

`examples/prefork-server.ts` is #478's acceptance program:

- One child per core.
- Every child listens on the same TCP port (`tcpListenFlags(…, 1)`) and the same UDP port (`udpBind(…, 1)`). Over HTTP/1 it answers with its worker index and pid.
- The parent restarts a child that dies, and shuts everything down cleanly on SIGTERM through `signalFd`.

### Tests

These are `tests/link/` cases, driven by a harness on the pattern of `tests/link/net_http1_server/harness.ts`:

1. **Spread.** With 4 workers and 400 loopback connections, at least two distinct worker pids answer. Gate it on Linux.
2. **A dead worker.** SIGKILL one worker. The remaining workers keep answering at once, with no failed request after the kill is observed, and the supervisor restarts it, a new pid joining.
3. **SIGTERM.** Every worker exits, the parent exits 0, and no child is left (`kill(pid, 0)` gives ESRCH).
4. **Arena budget per worker.** Each worker serves 200 requests on a warmed slot, then reports `Arena.used()`'s delta, which is 0 in every worker. Read the existing http1 arena-flat check for the method.
5. **A crash loop backs off.** A worker that exits at once is restarted no more often than the backoff allows.

### Docs

- `networking.md` gets a "Using every core" section: the example, the Darwin caveat, and the env knobs.
- `standard-library.md` gets `nish/net/prefork`, and `docs/AI.md` gets a line.
- Security rows in `docs/security/`:
  - socket sharing between workers;
  - what a restarted worker inherits;
  - the SIGTERM path.

  Update `README.md`'s counts.

## Bench measurement

**Owns:** `bench/http1-server.ts`, `bench/README.md`

- `bench/http1-server.ts` reads `BENCH_CORES`. With it unset, or set to 1, the program is today's binary behaviour, so the existing 1-core tables stay comparable. With N > 1 it serves through `std/net/prefork` with N workers.
- Run `bash bench/http-twins/run.sh --cores 1,2,4` with every twin built. Record in `bench/README.md`:
  - the machine (CPU model, core count) and the core layout;
  - a req/s table per core count and scenario;
  - the nish-copy band;
  - the scaling ratio of each server from 1 to N.
- Where the machine has fewer than N + 1 cores, the table says the client shared the server's cores at that N.
- The commit's `Measured:` trailer gives nish's plaintext req/s at 1, 2 and 4 cores, and the band, copied from the README's table.

## Generated files

These are regenerated with the repo's tooling and never edited or hand-merged:

- `tests/self/goldens/checked.txt`, `checked-self.txt`: `node tests/self/goldens.js --update`.
- `tests/differential/goldens/**`: `node tests/differential/goldens.js --update`.
- `tests/cases/*.ll`: `npm run test:update`.
- `tests/link/**/*.ll`: `node tests/run.js <case> --update-link-goldens`.
- The cookbook runtime prelude: `bash docs/cookbook/regen.sh`.
- `CHANGELOG.md`.

## Out of scope

- Handing a socket to a `scope()` task, which would need a descriptor-ownership rule. WP42 records what that rule would need.
- State shared between workers.
- Hot reload and a zero-downtime binary upgrade.
- SIGCHLD in `signalFd`.
- Changing `tcpListen`'s signature.

## Verification

- Per stage, its `verification` line.
- Every stage that touches `src/` or `std/` also runs, before the PR opens:
  - `npm run check`;
  - `npm run lint`;
  - `node tests/run.js wasi`, with its skip line read;
  - `node tests/run.js performance`;
  - an undegraded `npm test`, with its skip count read.
