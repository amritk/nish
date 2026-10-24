# WP35: Capabilities — what a program can reach, reported

**Status: built** in #423 (2026-10-02), report only. The compiler works out
which capabilities every function, module and package can reach, keeps one
witness call chain per capability, and reports them through
`--emit-capabilities <file.json>` and `--capabilities` (on a compile or under
`nish run`). Refusing a program for what it reaches is WP36's
([wp36-capability-policy.md](wp36-capability-policy.md), #452), which also
wired the `unsafe` bit this note reserved.

**The living reference is [LANGUAGE.md](LANGUAGE.md#capabilities)**: the
label of every builtin, what is ambient, granularity, determinism and the
report's shape. Where this note and LANGUAGE.md disagree, LANGUAGE.md wins.
What follows is the record of why it is built the way it is.

## 0. Why it can be exact

Every call in Nish is direct: a generic is monomorphised, a function parameter
is an instantiation per callee, and a parallel body is reached by a direct
call from its instance. So a whole-program answer needs no "unknown callee"
case for user code. The one opaque callee is a `declare function`, and calling
one *is* the `ffi` capability.

## 1. The set

Twelve capabilities, each a bit of an `i32` mask in alphabetical order
(`src/capabilities.ts`): `clock`, `entropy`, `env`, `exit`, `ffi`, `fs.read`,
`fs.write`, `net`, `process.spawn`, `signal`, `tty`, `unsafe`. Printing, argv,
`process.platform` and `process.arch`, `panic`, arena control and pure
computation are ambient: none of them can make a program's answer differ
between runs, or each is a constant of the build. A program is
**deterministic** when it reaches none of `clock`, `entropy`, `env`, `ffi`,
`fs.read`, `fs.write`, `net`, `process.spawn` and `tty` (`nish:term`, which
reads stdin against the clock and asks the terminal). `exit` and `signal` keep it
deterministic, since a chosen status is computed from the input and a run
nobody signals is the same run every time.

`unsafe` is not a capability of the world but the one way a program gives up a
check, and it travels like the others: a function that calls a `nish:unsafe`
export carries it, and so does every caller, module and package above it,
including a dependency that imports `nish:unsafe` when the entry package does
not (#432). It keeps a program deterministic. The deprecated `--wrapping` and
`--unchecked-indexing` carry no `unsafe`, although they too give up a check
the source does not show: they reach only the entry package, each compile that
passes one prints its deprecation note (NL9014), and they sit on the same
command line that passes `--deny unsafe`, so a policy has nothing to learn
from the bit that the compile does not already print. They are on their way
out. `--unchecked-indexing` also notes each site it leaves unchecked (NL7002),
and `nish --fix` rewrites those into `uncheckedGet` and `uncheckedSet` calls,
which do carry it; `--wrapping` has no fixer, and its note names the
`nish:unsafe` exports to write instead.

## 2. The audit

Every builtin the checker accepts has exactly one row in `builtinCapability`
(`src/capabilities.ts`): a capability, or a deliberate `none`. The key is the
checker-facing name (`readFileSync`, `process.exit`, `netRead`), not the
runtime symbol a call lowers to, because one runtime symbol can serve several
builtins and the witness needs the call site anyway. A `nish:` export is keyed
by the builtin it renames (`BuiltinExport.canonical`), so `exit` from
`nish:process` is `process.exit`'s row, and the two spellings cannot be
labelled apart.

| label | builtins |
| --- | --- |
| `fs.read` | `readFileSync`, `readFileSyncOrNull`, `readFileBytesSync`, `readdirSync`, `realpathSync`, `isDirectorySync`, `lstatOwnerModeSync`, `isExecutableSync` |
| `fs.write` | `writeFileSync`, `appendFileSync`, `mkdirSync` |
| `process.spawn` | `spawnSync`, `spawnSyncTo`, `spawn`, `kill`, `waitPid` |
| `net` | every `nish:net` export: `netAddress`, `netLocalPort`, `tcpListen`, `tcpListenFlags`, `tcpAccept`, `netRead`, `netWrite`, `netShutdown`, `netClose`, `tcpConnect`, `connectResult`, `udpBind`, `udpSendTo`, `udpRecvFrom`, `pollCreate`, `pollAdd`, `pollModify`, `pollRemove`, `pollWait` |
| `env` | `getenv`, `geteuid` |
| `clock` | `Date.now`, `monotonicNanos`, `statMtimeSync` |
| `entropy` | `crypto.getRandomValues`, `Math.random` |
| `signal` | `signalFd`, `readSignal` |
| `exit` | `process.exit` (and `exit` from `nish:process`) |
| `ffi` | any call to a `declare function` (no table row: it is the callee's kind) |
| `unsafe` | the six `nish:unsafe` exports (`uncheckedGet`, `uncheckedSet`, `wrappingAdd`, `wrappingSub`, `wrappingMul`, `readCString`); wired by WP36, reported since #432 |
| none | `toI32`, `toI64`, `toU8`, `toU16`, `toU32`, `toU64`, `toF32`, `toF64`, `f64ToBits`, `bitsToF64`, `ctSelect`, `ctEq`, `secureZero`, `parseInt`, `parseFloat`, `Number`, `Ok`, `Err`, `write`, `writeError`, `panic`, `console.log`, `console.error`, `String.fromCharCode`, `String.fromBytes`, `Math.sqrt`, `Math.floor`, `Math.ceil`, `Math.trunc`, `Math.round`, `Math.sin`, `Math.cos`, `Math.exp`, `Math.log`, `Math.pow`, `Math.abs`, `Math.min`, `Math.max`, `Arena.reset`, `Arena.mark`, `Arena.release`, `Arena.used`, `arena`, and the properties `Math.PI`, `Math.E`, `process.argv`, `process.platform`, `process.arch`, and the host facts `availableParallelism`, `totalMemory` |

Four rows deserve their reason:

- **`Math.random` is `entropy`**, although it is a pseudo-random generator:
  runtime.c's `nish_random` seeds it from `time(0)` and `getpid()` on first
  use, so two runs answer differently.
- **`statMtimeSync` is `clock`**, not `fs.read`. It reads the file system, but
  what it answers is a time, and a builtin carries one label.
- **`spawnSyncTo` is `process.spawn`**, not also `fs.write`, for the same
  reason: the child it starts can write anything anyway, so `process.spawn`
  already says more than `fs.write` would.
- **`availableParallelism` and `totalMemory` are none**, although each asks
  the host: how many cores and bytes the machine has is a fact about it, as
  `process.platform` is, which a program reads to size itself and not to reach
  anything. `kill` and `waitPid` are `process.spawn`: `kill` reaches any process
  of the program's user, as kill(1) does, not only the children `spawn`
  starts, and `waitPid` reaps those children, so both reach other processes
  the way starting one does.

**Unlabelled is a bug, and it is executable.** `builtinCapability` answers a
capability's index, `CAP_NONE` (-1, the deliberate none) or `CAP_UNLABELLED`
(-2). The walk in
`src/attributes.ts` that meets a builtin call answering `CAP_UNLABELLED` is an
internal compiler error (exit 70, `src/ice.ts`'s
`unlabelledBuiltinError`, which names the builtin under `--json` too), and `tests/capabilities.js`
enumerates every name the checker accepts — the plain callees of
`isBuiltinFunction`, the conversions, the `nish:net` exports, the dotted list
the checker's refusal names, the namespace properties, the `Result`
constructors and every `nish:` export — and fails `npm test` when one has no
row, or a row names no builtin, before any program calls it. The ICE itself is
pinned through the suite's hook: `NISH_SIMULATE_ICE=unlabelled:<name>` compiles
as usual but treats `<name>` as unlabelled.

## 3. Propagation and the witness

Round 2 of the attribute walk in `src/attributes.ts` seeds a builtin call's
bit (and a `declare function` call's `ffi`) with a witness at distance 0, and
records each user call as an edge. `propagateCapabilities` then relaxes over
those edges with a worklist: a function's mask is the union of its callees',
and each bit keeps the shortest chain, ties going to the earlier call in the
source, so the report is byte-stable whatever order modules load in. It is a
relaxation of its own rather than part of the attribute fixpoint, so round 1
and the attribute iteration count did not move, and no attribute reads a
capability, so no `.ll` byte moved.

## 4. Granularity

A function is judged per instantiation; a module's set is the union over its
functions, a package's over its modules (`<root>`, `nish` for a module
resolved in the standard library, a dependency by name), and the program's is
`main`'s closure, or the entry's exported functions when it has no `main`. A
parallel body reaches nothing, because every builtin that carries a
capability writes memory the runtime shares, which the WP29 rule already
refuses there (`tests/link/caps_parallel`, `reject_caps_parallel_clock`).
`unsafe` is the exception WP36 added: `uncheckedGet` writes nothing.

## 5. The report

`--emit-capabilities` writes version 1: entry, `deterministic`, the program's
set, then packages, modules and exported functions with their sets and a
witness chain per capability, every path relative to the entry's directory.
Since #443 each function also lists its `"panics"`. `src/capability-report.ts`
lays it out and decides nothing; `tests/nish/cli.ts` holds it byte for byte.
`--capabilities` prints one line on stderr before the program runs and is not
part of the run-cache key, since the IR names the entry.

## 6. Cost

On the self-compile of `src/`, by instructions retired under callgrind:
1,688,381,447 before and 1,691,910,149 after, **+0.21%**. A first version
that relaxed in whole passes cost +1.10%; the worklist took it to a fifth of
that. Wall time moved within its noise.

## 7. Out of scope

- **Enforcement**: built as WP36's compile-time policy. Holding a running
  process to the computed set (`--sandbox`) is WP37's, proposed in
  [wp37-os-sandbox.md](wp37-os-sandbox.md) and not built.
- Argument-level precision (which path is read, which host is dialled),
  capability-typed handles, and taint.
- Nondeterminism from thread scheduling or float reduction order.
- Memory-safety facts, and any change to emitted IR or to an attribute.
