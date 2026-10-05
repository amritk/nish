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

Eleven capabilities, each a bit of an `i32` mask in alphabetical order
(`src/capabilities.ts`): `clock`, `entropy`, `env`, `exit`, `ffi`, `fs.read`,
`fs.write`, `net`, `process.spawn`, `signal`, `unsafe`. Printing, argv,
`process.platform` and `process.arch`, `panic`, arena control and pure
computation are ambient: none of them can make a program's answer differ
between runs, or each is a constant of the build. A program is
**deterministic** when it reaches none of `clock`, `entropy`, `env`, `ffi`,
`fs.read`, `fs.write`, `net` and `process.spawn`. `exit` and `signal` keep it
deterministic, since a chosen status is computed from the input and a run
nobody signals is the same run every time.

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
| `process.spawn` | `spawnSync`, `spawnSyncTo` |
| `net` | every `nish:net` export: `netAddress`, `netLocalPort`, `tcpListen`, `tcpAccept`, `netRead`, `netWrite`, `netShutdown`, `netClose`, `tcpConnect`, `connectResult`, `udpBind`, `udpSendTo`, `udpRecvFrom`, `pollCreate`, `pollAdd`, `pollModify`, `pollRemove`, `pollWait` |
| `env` | `getenv`, `geteuid` |
| `clock` | `Date.now`, `monotonicNanos`, `statMtimeSync` |
| `entropy` | `crypto.getRandomValues`, `Math.random` |
| `signal` | `signalFd`, `readSignal` |
| `exit` | `process.exit` (and `exit` from `nish:process`) |
| `ffi` | any call to a `declare function` (no table row: it is the callee's kind) |
| `unsafe` | the five `nish:unsafe` exports (`uncheckedGet`, `uncheckedSet`, `wrappingAdd`, `wrappingSub`, `wrappingMul`); wired by WP36 |
| none | `toI32`, `toI64`, `toU8`, `toU16`, `toU32`, `toU64`, `toF32`, `toF64`, `f64ToBits`, `bitsToF64`, `ctSelect`, `ctEq`, `secureZero`, `parseInt`, `parseFloat`, `Number`, `Ok`, `Err`, `write`, `writeError`, `panic`, `console.log`, `console.error`, `String.fromCharCode`, `Math.sqrt`, `Math.floor`, `Math.ceil`, `Math.trunc`, `Math.round`, `Math.sin`, `Math.cos`, `Math.exp`, `Math.log`, `Math.pow`, `Math.abs`, `Math.min`, `Math.max`, `Arena.reset`, `Arena.mark`, `Arena.release`, `Arena.used`, `arena`, and the properties `Math.PI`, `Math.E`, `process.argv`, `process.platform`, `process.arch` |

Three rows deserve their reason:

- **`Math.random` is `entropy`**, although it is a pseudo-random generator:
  runtime.c's `nish_random` seeds it from `time(0)` and `getpid()` on first
  use, so two runs answer differently.
- **`statMtimeSync` is `clock`**, not `fs.read`. It reads the file system, but
  what it answers is a time, and a builtin carries one label.
- **`spawnSyncTo` is `process.spawn`**, not also `fs.write`, for the same
  reason: the child it starts can write anything anyway, so `process.spawn`
  already says more than `fs.write` would.

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
  process to the computed set (`--sandbox`) is WP37's, not yet written.
- Argument-level precision (which path is read, which host is dialled),
  capability-typed handles, and taint.
- Nondeterminism from thread scheduling or float reduction order.
- Memory-safety facts, and any change to emitted IR or to an attribute.
