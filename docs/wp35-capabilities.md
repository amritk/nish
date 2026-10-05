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

Every builtin the checker accepts has exactly one row in `builtinCapability`,
keyed by its checker-facing name (a `nish:` export by the builtin it renames),
answering a capability, the deliberate `CAP_NONE`, or `CAP_UNLABELLED`. Three
rows were choices: `Math.random` is `entropy` (it is seeded from the time and
the pid), `statMtimeSync` is `clock` (it answers a time), and `spawnSyncTo` is
`process.spawn` alone. An unlabelled builtin is an internal compiler error
(exit 70, `unlabelledBuiltinError`), and `tests/capabilities.js` fails
`npm test` when any accepted name has no row, before a program calls it.

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
