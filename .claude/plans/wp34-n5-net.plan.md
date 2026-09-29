---
name: WP34 N5 — sockets and the loop a program owns (nish:net)
overview: A builtin module `nish:net` whose handles are `i32` descriptors — non-blocking TCP, UDP with GSO, GRO, ECN and SO_REUSEPORT, and a readiness loop (epoll on Linux, kqueue on Darwin) that can wait on N3's signal descriptor — in a new runtime unit `runtime/runtime-net.c` with its own `.text*` ceiling, and nothing on the per-packet path that allocates. Three sequential slices, because all three edit the same builtin tables.
stages:
  - id: net-tcp
    title: "feat(runtime): nish:net — a runtime-net.c unit, addresses and non-blocking TCP (WP34 N5)"
    goal: The new unit named in all five places, the `nish:net` module registered, the address form, and non-blocking TCP driven from Node by a TCP echo written in Nish
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, read the skip count) && node tests/run.js budget && node tests/run.js net_ && node scripts/gen-diagnostic-codes.mjs --check && node tests/diagnostic-coverage.js --require-coverage && node docs/check-links.mjs
    todos:
      - id: tcp-unit
        content: Add runtime/runtime-net.c (empty under __wasi__/__wasm__) and name it in the five places in one commit, scripts/build.sh first — see Slice (a) › The unit
      - id: tcp-module
        content: Register nish:net in src/nish-modules.ts (isNishModule, nishModuleNames, nishModuleExports, nishExport) with every export also a global — see Slice (a) › Registration
      - id: tcp-surface
        content: Check and emit netAddress, netLocalPort, tcpListen, tcpAccept, netRead, netWrite, netShutdown, netClose in src/builtins.ts, src/emit-builtins.ts, src/runtime.ts, runtime/nish.h — see The surface
      - id: tcp-written-args
        content: Generalise builtinWrittenArgument (src/emit-util.ts) to identifier builtins and to more than one written argument, and feed it to attributes.ts and parallel.ts regionCallMessage — see Slice (a) › Written arguments
      - id: tcp-bounds
        content: Emit the off/len range check in IR through emitSliceCheck, the same panic words as set — see Decisions › Bounds
      - id: tcp-refusals
        content: Refuse each call on wasm (refuseOnWasm, NL2404), a readonly written buffer, a wrong element type, and a call inside scope() tasks, parallel bodies and a scope region, each with a reject_net_ case — see Decisions › Refusals
      - id: tcp-ts-reading
        content: Declare nish:net and the globals in runtime/nish.d.ts, and make runtime/nish.mjs and runtime/shim.mjs throw the named message — see Decisions › The TypeScript reading
      - id: tcp-tests
        content: Add net_ goldens, a Node-driven TCP echo in the net_ block of tests/run.js, and the Arena.used() flat check — see Tests
      - id: tcp-docs
        content: Write the LANGUAGE.md nish:net section (TCP, addresses, errors, bounds, threads, wasm, TS reading), the Builtin modules row, the AI.md lines, a cookbook entry, and the new unit in wp7-runtime.md, .claude/architecture.md and AGENTS.md — see Docs
  - id: net-udp
    title: "feat(runtime): nish:net UDP with GSO, GRO, ECN and SO_REUSEPORT (WP34 N5)"
    goal: UDP sockets whose one send leaves as several datagrams and whose one receive returns several with the segment size, observed from the Nish side on Linux, and a UDP echo driven from Node
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, read the skip count) && node tests/run.js budget && node tests/run.js net_ && node scripts/gen-diagnostic-codes.mjs --check && node tests/diagnostic-coverage.js --require-coverage && node docs/check-links.mjs
    todos:
      - id: udp-surface
        content: Add udpBind, udpSendTo, udpRecvFrom to the checker, emitter, runtime table, nish.h and runtime-net.c, with UDP_SEGMENT, UDP_GRO, the ECN cmsgs and SO_REUSEPORT — see Slice (b)
      - id: udp-darwin
        content: Give the Darwin branch the same calls with GSO, GRO and ECN answering -95 — see Decisions › Platforms
      - id: udp-tests
        content: Add the Node-driven UDP echo and the GSO/GRO observation to the net_ block, plus goldens and reject_net_ cases — see Tests
      - id: udp-measure
        content: Measure loopback datagrams per second with and without GSO and put it in the Measured trailer — see Slice (b) › Measurement
      - id: udp-docs
        content: Extend the LANGUAGE.md nish:net section, cookbook and AI.md with UDP, and re-measure the net ceiling in wp7-runtime.md — see Docs
  - id: net-loop
    title: "feat(runtime): nish:net readiness loop that wakes on sockets and SIGTERM (WP34 N5)"
    goal: A loop a program owns — create, add, modify, remove and wait with a millisecond timeout — over epoll on Linux and kqueue on Darwin, able to wait on signalFd, with N5 marked built
    verification: npm run check && npm run lint && npm run lint:dead && npm test (undegraded, read the skip count) && node tests/run.js budget && node tests/run.js net_ && node scripts/gen-diagnostic-codes.mjs --check && node tests/diagnostic-coverage.js --require-coverage && node docs/check-links.mjs
    todos:
      - id: loop-surface
        content: Add pollCreate, pollAdd, pollModify, pollRemove, pollWait to the checker, emitter, runtime table, nish.h and runtime-net.c (epoll and kqueue) — see Slice (c)
      - id: loop-tests
        content: Add the two-socket loop that wakes on whichever socket is readable first and on SIGTERM through signalFd, driven from Node, plus goldens and reject_net_ cases — see Tests
      - id: loop-docs
        content: Finish the LANGUAGE.md section and cookbook with the loop, add the nish:net row to wp33-round-trip.md §3.5, and mark N5 built in wp34 §N5 and its status line after merging main — see Docs
---

# WP34 N5 — sockets and the loop a program owns

## Context

[wp34 §N5](../../docs/wp34-hosting-cs.md) asks for a builtin module `nish:net` with UDP (plus GSO, GRO, ECN and `SO_REUSEPORT`), non-blocking TCP, and an `epoll` loop that can wait on N3's signal descriptor. [wp24 §2](../../docs/wp24-async.md) refused `async` because the language had nothing to wait on. This adds something to wait on, but not `async`: the program owns its loop and blocks in `pollWait`. [wp26 §2](../../docs/wp26-stdlib.md) puts syscalls in builtins, which is why this is `nish:` and not `nish/`.

The precedent is N3 (#312, commit 163eb76). It added `runtime-host.c` and `signalFd`/`readSignal`. Its review found that the plan had not given the stage `scripts/build.sh`, so every stage here owns every file the precedent touched.

## Decisions (recorded in the tracking issue)

| | Decision | Why |
| --- | --- | --- |
| **Platforms** | **Linux:** `epoll` and the full surface. **Darwin:** the same calls over `kqueue`; GSO, GRO and ECN answer `-95` ("unsupported") rather than failing to link. **wasm32/WASI:** every call is refused by the checker through `refuseOnWasm` (NL2404, the rule N3's builtins use), and `runtime-net.c` is empty there | Darwin's `bootstrap` rows in CI link through `scripts/build.sh`, so the Darwin branch is compiled on every PR but never run. Each PR says so |
| **Errors** | An `i32` return. `>= 0` is success (a descriptor, a count, 0). `< 0` is a negative errno **in Linux numbering on every platform** for the codes a loop branches on: `-11` would block, `-95` unsupported, `-32` peer gone, `-104` reset, `-98` address in use, `-22` bad argument. Any other failure is the host's `-errno` | This matches N2 and N3, which fail with a sentinel and not a `Result` (no builtin returns `Result<T, E>` today), and it allocates nothing |
| **Addresses** | A caller's `u8[]` of at least 18 bytes: 16 address bytes (an IPv4 address as `::ffff:a.b.c.d`), then the port, big-endian. `netAddress(out, host, port)` fills one from a numeric literal. There is no DNS | No allocation per packet (N9); one form for both families |
| **Dual stack** | A bind to `::` is an `AF_INET6` socket with `IPV6_V6ONLY` off. When the kernel has no IPv6 (`EAFNOSUPPORT`, as in the cloud containers), `::` and any IPv4 literal fall back to `AF_INET` | This container measured `EAFNOSUPPORT` for `AF_INET6`. Tests use `127.0.0.1` |
| **Bounds** | `off` and `len` are range-checked in the IR through `emitSliceCheck`, with the panic words `set` uses; `--unchecked-indexing` drops the check. An address, `meta` or `ready` array that is too short answers `-22` from C | This is the same rule, in the same place, as N2's `set` |
| **Globals** | Every `nish:net` export is also a global, like every other `nish:` export. The names carry a `net`/`tcp`/`udp`/`poll` prefix, so none of them collides with the existing global `write` | The emitter and attribute paths are gated on `isBuiltinFunction` (`emit-builtins.ts:626`, `:818`), so an import-only builtin would be a new, riskier path |
| **Threads** | Every call is `EFFECT_WRITE` (shared) in `src/runtime.ts`. That already refuses it in a `scope()` task and a parallel body (`parallel.ts` `sharedWriteMessage`). A call that writes a caller's array is also refused in a scope's region on an array a task may read. Each case gets a `reject_net_` test | This is the refusal rule every shared-writing runtime call already follows |
| **The TypeScript reading** | **Class C**, with no synchronous reading, like `signalFd`. `runtime/nish.d.ts` declares `module "nish:net"` and the globals, so `npm run check` types these programs. Every function in `runtime/nish.mjs` / `shim.mjs` throws `` `<name>` has no synchronous reading under Node: a socket is ready only to the event loop, which a program that owns its loop never returns to (docs/wp33-round-trip.md) `` | Node's sockets are asynchronous only, and WP33 §6 needs one stated answer |
| **Allocation (N9)** | Nothing in `runtime-net.c` allocates. No call returns arena memory, so none goes in `isAllocatingBuiltin`. A test runs an echo loop body as a pass scope and requires `Arena.used()` to be flat across N iterations | This is wp34 N9's second rule |
| **Budget** | `NET_TEXT_BUDGET` is set in slice (a) at the next 256-byte boundary above its measurement. Slices (b) and (c) raise only that ceiling, each with a fresh measurement in `docs/wp7-runtime.md` | The unit grows with its surface. The four existing ceilings do not move |
| **Codes** | Only NL2405–NL2414, as the next free code in that block. Wordings are reused where they fit: NL2402's `` fills a `u8[]`, got `` and NL2404's wasm refusal. Suggested split: (a) 2405–2408, (b) 2409–2411, (c) 2412–2414 | These codes are reserved for this lane |

## The surface

Every function returns `i32` and takes `i32` descriptors. Proposed names follow; slice (a) may rename them, and LANGUAGE.md is the contract.

```ts
// addresses — slice (a)
netAddress(out: u8[], host: string, port: i32): i32      // 0, or -22 for a non-literal host or a short `out`
netLocalPort(fd: i32): i32                                 // the bound port
// TCP — slice (a); every socket is non-blocking and close-on-exec
tcpListen(host: string, port: i32, backlog: i32): i32     // SO_REUSEADDR; dual-stack on "::"
tcpAccept(fd: i32, peer: u8[]): i32                        // a new fd, or -11
netRead(fd: i32, buf: u8[], off: i32, len: i32): i32       // bytes, 0 at EOF, or -11
netWrite(fd: i32, buf: u8[], off: i32, len: i32): i32      // bytes; a gone peer is -32, never SIGPIPE
netShutdown(fd: i32, how: i32): i32                        // 0 read, 1 write, 2 both
netClose(fd: i32): i32
// UDP — slice (b)
udpBind(host: string, port: i32, flags: i32): i32          // flags: 1 SO_REUSEPORT, 2 UDP_GRO; ECN reception always on
udpSendTo(fd: i32, buf: u8[], off: i32, len: i32, to: u8[], segment: i32, ecn: i32): i32   // segment > 0 → UDP_SEGMENT
udpRecvFrom(fd: i32, buf: u8[], off: i32, len: i32, from: u8[], meta: i32[]): i32         // meta[0] segment size (0 if not coalesced), meta[1] ECN bits
// the loop — slice (c); level-triggered
pollCreate(): i32
pollAdd(loop: i32, fd: i32, events: i32, token: i32): i32  // events: 1 readable, 2 writable
pollModify(loop: i32, fd: i32, events: i32, token: i32): i32
pollRemove(loop: i32, fd: i32): i32
pollWait(loop: i32, ready: i32[], timeoutMs: i32): i32     // n; ready[2k] token, ready[2k+1] events (4 = hang-up/error); 0 on timeout; -1 ms waits forever
```

The written arguments are `out`, `peer`, `buf` (reads), `from`, `meta` and `ready`. A readonly array there is refused with `readonlyWriteMessage`. Each of them makes the caller's parameter non-`readonly` through `builtinWrittenArgument`. `buf` is only read by `netWrite` and `udpSendTo`.

Attributes: `nounwind` on all of them. `pollWait` gets no `willreturn`, because it can wait forever. Anything else marked `willreturn` needs its reason written beside it in `src/runtime.ts` / `src/attributes.ts`.

## Slice (a): the unit, registration and TCP

**The unit.** Create `runtime/runtime-net.c` with the header shape of `runtime-host.c`: why it is a unit of its own, the platform differences, and an empty body under `__wasi__`/`__wasm__`. Name it in the five places **in one commit**:
1. `scripts/build.sh:101`, the `for half in …` list.
2. `RUNTIME_C` (`tests/run.js:92`) and the `npm pack` required list (`tests/run.js:~10240`).
3. `tests/nish/run.ts:488`.
4. `src/run-cache.ts:102`.
5. `NET_TEXT_BUDGET` beside `RUNTIME_HOST_TEXT_BUDGET` (`tests/run.js:5362`, table at 5405).

The prose that counts "four translation units" (`scripts/build.sh`, `.claude/architecture.md`'s budget table, `AGENTS.md`'s house rule) is updated to five in the same commit.

**Registration.** `src/nish-modules.ts`:
- `isNishModule` and `nishModuleNames`;
- a `nishModuleExports` branch **before** the `nish:io` fall-through;
- `nishExport` entries as `new BuiltinExport("", name, false)`.

`bindBuiltinImport` in `src/checker.ts` needs no change unless that proves wrong.

**Written arguments.** Today `builtinWrittenArgument` (`src/emit-util.ts:137`) recognises only `crypto.getRandomValues`'s dotted callee, and returns one node. Generalise it to identifier builtins (through `builtinNameOf`) and to a list of written argument positions. Then call `noteArrayWrite` from `collectIdentifierBuiltinFacts` (`attributes.ts:1655`), return `USE_WRITE` for these in `classifyArgumentUse`, and give `parallel.ts` `regionCallMessage` an identifier-callee branch outside the `N_MEMBER` one. `crypto.getRandomValues` must keep its IR byte for byte.

## Slice (b): UDP

- `udpBind` sets `IP_RECVTOS` / `IPV6_RECVTCLASS`, plus `SO_REUSEPORT` and `UDP_GRO` when their flags are set.
- `udpSendTo` uses one `sendmsg`, with a `UDP_SEGMENT` cmsg when `segment > 0` and an `IP_TOS` / `IPV6_TCLASS` cmsg for `ecn`.
- `udpRecvFrom` uses one `recvmsg` and reads the `UDP_GRO` and TOS/TCLASS cmsgs into `meta`.
- The cmsg buffers are on the stack.

**Measurement.** Measure loopback datagrams per second with a Nish sender and receiver, 1,200-byte payloads, first one datagram per `udpSendTo` and then `segment = 1200` over 64 KB sends. Put the numbers and the method in the commit's `Measured:` trailer and in the PR. This is not a test.

## Slice (c): the loop

- On Linux, `epoll_create1(EPOLL_CLOEXEC)`, `epoll_ctl` and `epoll_wait`, with the token in `data.u32`.
- On Darwin, `kqueue`, with `EVFILT_READ`/`EVFILT_WRITE` and the token in `udata`.
- `pollWait` fills at most `ready.length / 2` pairs and retries `EINTR` by returning 0, not by looping past the deadline.
- The signal descriptor from `signalFd()` is added like any other fd.

When done, merge `main` first, because lane 4 is rewriting wp34's status line. Then mark N5 **built** in wp34 §N5 ("**State.** Done in #…") and in the note's status line, and add the `nish:net` row to [wp33 §3.5](../../docs/wp33-round-trip.md) as class C. That row is the only edit to that file.

## Tests

| What | Where | Slice |
| --- | --- | --- |
| a golden `.ll` for each call family, through `llvm-as` | `tests/cases/net_*.ts`/`.ll` | all |
| TCP echo: the Nish program listens on `127.0.0.1:0` and prints its port; Node connects, sends, reads the echo, and closes; the program exits 0 | `tests/cases/net_tcp_echo.ts` + the `net_` block in `tests/run.js` (modelled on the `os_` block's `signalRun`) | a |
| `Arena.used()` flat across N iterations of an echo body run as a pass scope | same program, a printed line | a |
| UDP echo, driven from Node's `dgram` | `net_udp_echo` | b |
| GSO: one `udpSendTo(segment=1200)` of 4,800 bytes arrives at a Node `dgram` socket as 4 datagrams. GRO: Node sends 4 datagrams and the Nish receive with `UDP_GRO` returns ≥ 2 of them in one call with `meta[0] == 1200`. On a non-Linux host the block prints why it does not apply and counts as a pass, **not** a skip | `net_udp_gso` | b |
| a two-socket loop wakes on the socket Node writes to first, in both orders, and then wakes on SIGTERM through `signalFd()` and exits 0 | `net_loop_two` | c |
| every refusal: wasm (one per slice), a readonly written buffer, a wrong element type, arity, a call in a `scope()` task, in a parallel body, and a scope-region write | `tests/cases/reject_net_*`, `tests/wordings/nl24NN_*` | all |
| an unknown `nish:net` export | `reject_net_unknown_export` | a |

Also:
- each new runnable case goes in `tests/differential/goldens/unfrozen.txt`;
- `node tests/self/goldens.js --update` runs after `npm run build`, and the diff is read;
- the PR shows the exact LLVM IR for every TypeScript snippet it adds.

## Docs

- `docs/LANGUAGE.md`: a `nish:net` section after "The host". It has the signature table in that section's format, the errors rule, the address form, bounds, threads, wasm and the TypeScript reading, each rule citing its case. Also the `nish:net` row in "Builtin modules".
- `docs/IR_COOKBOOK.md` gets an entry regenerated from `docs/cookbook/builtin-net.ts`, and `docs/AI.md` gets the net lines.
- `docs/RUN_UNDER_NODE.md` gets the throw bullet.
- `docs/wp7-runtime.md` §"Runtime additions and budget" gets the net unit's measurement in every slice.
- `CHANGELOG.md` is written by the commits (`feat(runtime): …`), not by hand.

## Out of scope (filed as issues, not widened into)

- `tcpConnect` and a Nish client. The loopback suite in wp34 §5 needs one; the echoes here are driven by Node.
- DNS and name resolution.
- Edge-triggered mode.
- Timers other than `pollWait`'s timeout.
- `sendmmsg`/`recvmmsg`.
- Windows.
- WASI sockets.
- Running the Darwin branch; it is only compiled.
- N9's 100,000-session soak, which belongs to A1.

## Ownership

The lane's brief names a narrower OWNS set. The N3 precedent touched more files than that, and none of the extra ones below belongs to another lane. Every stage owns the same set, because the stages run one after another:

`runtime/runtime-net.c`, `runtime/nish.h`, `runtime/nish.d.ts`, `runtime/nish.mjs`, `runtime/shim.mjs`, `src/builtins.ts`, `src/emit-builtins.ts`, `src/emit-util.ts`, `src/escape.ts`, `src/attributes.ts`, `src/parallel.ts`, `src/runtime.ts`, `src/nish-modules.ts`, `src/checker.ts`, `src/codes.ts`, `src/run-cache.ts`, `scripts/build.sh`, `tests/run.js`, `tests/nish/run.ts`, `tests/runtime-test.c`, `tests/cases/net_*`, `tests/cases/reject_net_*`, `tests/wordings/nl240[5-9]_*`, `tests/wordings/nl241[0-4]_*`, `tests/differential/goldens/unfrozen.txt`, `tests/self/goldens/*`, `docs/LANGUAGE.md` (the `nish:net` section and its Builtin modules row), `docs/AI.md` (net lines), `docs/IR_COOKBOOK.md`, `docs/cookbook/builtin-net*.ts`, `docs/RUN_UNDER_NODE.md`, `docs/wp7-runtime.md` (the budget section), `docs/MASTER_PLAN.md` (§2 budget numbers only), `.claude/architecture.md` (the budget table and the unit list), `AGENTS.md` (the runtime-unit house rule), `docs/wp34-hosting-cs.md` (§N5 and the status line; slice c), `docs/wp33-round-trip.md` (one §3.5 row; slice c).

**Never touched:**
- `src/lexer.ts`, `src/parser.ts`, `src/validator.ts` (lane 1);
- `src/portability*.ts` (lane 4; `portability.ts:27` already exempts `nish:` specifiers);
- `std/crypto/**` (lane 3);
- `src/members.ts` (lane 5).

If a slice turns out to need one of these, it stops and says so.

## Verification

For every slice:

```bash
npm run build && npm run check && npm run lint && npm run lint:dead
npm test                                  # read the summary: no DEGRADED, only environmental skips
node tests/run.js budget                  # every unit's size, reported in the PR
node tests/run.js net_                    # this lane's cases
node scripts/gen-diagnostic-codes.mjs --check && node tests/diagnostic-coverage.js --require-coverage
node docs/check-links.mjs
```
