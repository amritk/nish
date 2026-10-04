# WP35: Capabilities — what a program can reach, reported

**Built in one pull request, report only.** The compiler works out which
dangerous capabilities every function, module and package of a program can
reach, keeps one witness call chain per capability, and reports them through
`--emit-capabilities <file.json>` and `nish run --capabilities`. Nothing is
refused for a capability yet: enforcement is the next work package's (§7).

[LANGUAGE.md](LANGUAGE.md) stays normative. Where this note and LANGUAGE.md
disagree, LANGUAGE.md wins; its "Capabilities" rule is the short form of §1–§5.

## 0. Why it can be exact

Every call in Nish is direct, which is what makes a whole-program answer
possible without a conservative "unknown callee" case for user code:

- a generic is monomorphised, so each instantiation is its own symbol
  (`FunctionSig.instance`, [WP18](wp18-generics.md));
- a function parameter is an instantiation per callee
  (`apply$fn.6.square`), so there is no indirect call
  ([WP29](wp29-thread-surface.md), LANGUAGE.md "Function parameters");
- a `parallelMapInto`, `parallelReduce` or `spawn` body is reached by a direct
  call from the instance that runs it (`isParallelEntry`).

`src/attributes.ts` already runs a fixpoint over that call graph, keyed by LLVM
symbol across every module and package. Capabilities ride the same graph. The
one opaque callee is a `declare function` ([WP27](wp27-ffi.md)): its body is C,
so calling one *is* the `ffi` capability.

## 1. The set

Eleven capabilities, each an index whose bit (`1 << index`) is its place in an
`i32` mask (`src/capabilities.ts`). The indices are in alphabetical order, and every report prints a set in that order,
so a reader finds a name where they expect it:

| capability | what it means | why it is dangerous |
| --- | --- | --- |
| `clock` | reads a clock: the wall clock, the monotonic clock, a file's time | output that differs from run to run |
| `entropy` | reads randomness | the same |
| `env` | reads an environment variable | an input the caller may not know it is passing |
| `exit` | ends the process with a chosen status | skips the caller's remaining work |
| `ffi` | calls a `declare function` | C can do everything else in this table, invisibly |
| `fs.read` | reads the file system: contents, listings, path resolution, file kinds | an input that is not argv or stdin, and a way to read secrets |
| `fs.write` | creates or changes files and directories | lasting effects outside the process |
| `net` | opens, reads or writes a socket, or waits on one | talks to other machines |
| `process.spawn` | starts another program | the child can do anything, unobserved by this analysis |
| `signal` | receives operating-system signals | an asynchronous input |
| `unsafe` | reserved | nothing carries this bit yet; `nish:unsafe`'s five functions are labelled none until it is wired |

**Ambient is none.** These are not capabilities, and say why:

- **stdout and stderr** (`console.log`, `console.error`, `write`,
  `writeError`). Output is an effect, not an input: it cannot make the
  program's answer differ between runs, and a program that may not print is
  not one anybody writes.
- **`process.argv`**, and `process.platform` / `process.arch`. argv is the
  program's input by definition, and the other two are constants of the build
  (`--target`) rather than queries of the machine.
- **`panic`** and every other abort (`throw`, a failed bounds check). It ends
  the process as `exit` does, but with a fixed status and a message about the
  program's own bug; it is not a chosen effect.
- **Arena control** (`Arena.*` and `using a = arena()`), **`Math.*` except `random`**, the conversions,
  the constant-time builtins, the string, array, `Map` and `Set` surface, and
  **`nish/threads`**. They compute on memory the program owns.

**Deterministic** is a constant mask: a function, module or program is
`deterministic` iff it reaches none of `clock`, `entropy`, `env`, `fs.read`,
`fs.write`, `net`, `process.spawn` and `ffi`. Determinism means "the same argv
and stdin give the same output". `exit` keeps a program deterministic, because
the status it chooses is computed from the program's input; `signal` keeps it
deterministic as the brief sets the mask, because installing a signal
descriptor changes nothing until something outside sends a signal, and a run
nobody signals is the same run every time. Nondeterminism from thread
scheduling or float reduction order is out of scope (§7).

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
| `unsafe` | nothing yet |
| none | `toI32`, `toI64`, `toU8`, `toU16`, `toU32`, `toU64`, `toF32`, `toF64`, `f64ToBits`, `bitsToF64`, `ctSelect`, `ctEq`, `secureZero`, `parseInt`, `parseFloat`, `Number`, `Ok`, `Err`, `write`, `writeError`, `panic`, `console.log`, `console.error`, `String.fromCharCode`, `Math.sqrt`, `Math.floor`, `Math.ceil`, `Math.trunc`, `Math.round`, `Math.sin`, `Math.cos`, `Math.exp`, `Math.log`, `Math.pow`, `Math.abs`, `Math.min`, `Math.max`, `Arena.reset`, `Arena.mark`, `Arena.release`, `Arena.used`, `arena`, the five `nish:unsafe` exports (`uncheckedGet`, `uncheckedSet`, `wrappingAdd`, `wrappingSub`, `wrappingMul`), and the properties `Math.PI`, `Math.E`, `process.argv`, `process.platform`, `process.arch` |

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

Collected in **round 2 only** (the facts `analyzeFunctions` returns), in the
`FactCollector` walk that already visits every call:

- a builtin call seeds its label's bit with the witness
  `{ via: <builtin name>, site: <the call>, dist: 0 }`;
- a call to a `declare function` seeds `ffi` the same way, with the declare's
  own name as `via`. The foreign function itself carries no bits: the call
  site is where the capability is exercised, so the chain ends there;
- a call to a user function (and every callee the walk records for a fused
  `Map` lookup or a collection walk) is kept as an edge: the callee's symbol
  and the call node.

Then `propagateCapabilities` relaxes over those edges to a fixpoint, worked
from a list of the functions whose witnesses just moved over the edges turned
round, so only their callers are looked at again: a
function's mask is the union of its callees', and for each bit its witness is
the edge whose callee's witness is shortest, `dist + 1`. **Ties go to the
earlier site in the function's source** (the call's byte offset; every site of
one function is in one file, the one its body is written in), so the chain is
the shortest one and the report is byte-stable whatever order the program's
modules were loaded in. It terminates because bits only grow and each
`(dist, offset)` pair only shrinks, over a finite graph.

The order the list is worked in cannot change the answer: a callee's offers
only ever get shorter, so the smallest offer a caller holds at the end is the
smallest of its callees' final ones.

It is a relaxation of its own, run right after round 2's `propagate`, rather
than more work inside `propagateCallee`, for two reasons. The attribute
fixpoint's convergence does not depend on capabilities, so leaving them out of
it keeps round 1 and the attribute iteration count exactly as they were; and
the witness needs the call *site* of each edge, which `callees` — a set of
symbols — does not hold. No attribute reads a capability, which is why no
`.ll` byte moves.

A chain is rebuilt by following `via` from the function until a hop's `via` is
a builtin (`dist` 0).

## 4. Granularity

- A **function** is judged per instance: `pick<i32>` and `pick<string>`, or
  `apply<square>` and `apply<(x) => ...>`, are two entries with two sets, named
  as diagnostics name them (`FunctionSig.sourceName`).
- A **module**'s set is the union over every function defined in it.
- A **package**'s set is the union over its modules. The root package is named
  `<root>`, the standard library `nish`, and a dependency by its name. A
  module belongs to the standard library when it was resolved there
  (`isStdModule`, `src/std-modules.ts`), not when its package is called
  `nish`: nothing refuses a dependency of that name, and it gets an entry of
  its own (`tests/link/caps_package_named_nish`).
- The **program**'s set is the entry's closure: `main`'s, or, for an entry with
  no `main`, the union over the entry module's exported functions.
- A **parallel body** cannot reach a capability at all, which the brief's
  "a `parallelMapInto` body that calls `Date.now()`" fixture runs into: every
  builtin that carries a capability writes memory the runtime shares
  (`RuntimeFunction.sharedWrite`), and the WP29 rule refuses a parallel body
  that writes anything but its result, `Date.now`, `getenv`, `Math.random`,
  `readFileSync`, `process.exit` and a `declare function` alike. So
  `tests/link/caps_parallel` pins the instance and its body reaching nothing
  while the caller's own capability is reported, and
  `tests/cases/reject_caps_parallel_clock` pins the refusal the analysis relies
  on. Should a capability that writes nothing shared ever arrive, it would flow
  through the body's direct call like any other.

## 5. The report

`--emit-capabilities <file.json>` writes one object: two-space indent, a
trailing newline, keys in this order. The plan for the file reuses the
directory making `--emit-header` uses.

```json
{
  "version": 1,
  "entry": "main.ts",
  "deterministic": false,
  "capabilities": ["clock", "fs.read"],
  "packages": [
    {
      "name": "<root>",
      "capabilities": ["clock", "fs.read"],
      "modules": [
        {
          "path": "main.ts",
          "capabilities": ["clock", "fs.read"],
          "functions": [
            {
              "name": "main",
              "exported": true,
              "capabilities": ["clock", "fs.read"],
              "witnesses": {
                "fs.read": [
                  { "function": "main", "at": "main.ts:4:10", "calls": "load" },
                  { "function": "load", "at": "lib.ts:2:3", "calls": "readFileSync" }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}
```

The stability promise, which `tests/nish/cli.ts` checks byte for byte:

- `capabilities` arrays and `witnesses` keys use the fixed order of §1, never
  discovery order.
- `packages` are sorted with `<root>` first and the rest by name; `modules` by
  path; `functions` by name, then by symbol.
- `functions` lists every exported function and every instance of one.
  A private helper appears only inside witness chains.
- Paths are relative to the entry's directory, so a package module reads
  `node_modules/<pkg>/<file>` and the file does not depend on the checkout
  path. A standard-library module keeps its package-relative name
  (`std/threads.ts`), which is the name its diagnostics carry.
- `at` is `path:line:column`, 1-based, at the start of the call.
- `exported` is `true` in every entry of version 1, since only exported
  functions and their instantiations are listed; it is there so that a later
  version can list private functions without changing the shape.

The report is laid out by `src/capability-report.ts`, which reads the masks
and witnesses and decides nothing; the driver writes it once the program has
checked, before the IR, into a directory made the way a sidecar's is.

`nish run --capabilities main.ts` prints exactly one line on **stderr** before
the program runs — `capabilities: clock, fs.read (not deterministic)`, or
`capabilities: none (deterministic)` — and then runs it as usual, so stdout
stays the program's. The line is computed from the compile every run already
does, because the IR is what names the cache entry, so the flag is not part of
the run-cache key. Without `run` the same line is printed once the program
has checked. Both flags are answered there, after the checker and before the
emitter, so `--emit-checked` still gets them; `--emit-ast` stops before the
checker, and either flag beside it is a usage error rather than a report
silently not written. A program that will not run prints no line: under `run`
or beside `--link`, an entry with no `main` is refused first, and the refusal
is all it prints (`tests/run.js`, the WP35 block).

## 6. Cost

Measured on the self-compile of `src/compile.ts` (all of `src/`), by
instructions retired under callgrind, because wall time on the machine it was
measured on varied by more than the difference. The counts themselves drift by
about 0.3% from one batch of runs to the next, so each comparison is of
binaries run side by side: 1,688,381,447 before and 1,691,910,149 after
(+0.21%). The first version relaxed in whole passes over every edge until a
pass changed nothing, and cost +1.10% against the same baseline
(1,683,285,095 against 1,701,870,934); the worklist of §3 is what took it to a
fifth of that. Wall time moved within its noise (a best of 0.631 s against
0.636 s over eleven runs each). The walk adds one table lookup per builtin call
and one edge per user call.

## 7. Out of scope

- **Enforcement** of any kind — a manifest field under `"nish"` in
  `package.json`, a `--deny` flag, a diagnostic that refuses a program. That
  is the next work package, and it reads this analysis rather than repeating
  it. It landed as WP36 ([wp36-capability-policy.md](wp36-capability-policy.md)),
  which also wired the `unsafe` bit.
- Capability-typed handles and `using` tokens.
- Argument-level precision: which path is read, which host is dialled, taint.
- `nish:unsafe`: the bit is reserved and labels nothing yet; the module's
  five functions are labelled none until it is wired.
- wasm and WASI targets beyond reporting what the program calls.
- Nondeterminism from thread scheduling or float reduction order.
- Memory-safety and undefined-behaviour facts.
- Any change to emitted IR or to an LLVM attribute.
