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

Eleven capabilities, each one bit of an `i32` (`src/capabilities.ts`), printed
in this order everywhere:

| capability | what it means | why it is dangerous |
| --- | --- | --- |
| `fs.read` | reads the file system: contents, listings, path resolution, file kinds | an input that is not argv or stdin, and a way to read secrets |
| `fs.write` | creates or changes files and directories | lasting effects outside the process |
| `process.spawn` | starts another program | the child can do anything, unobserved by this analysis |
| `net` | opens, reads or writes a socket, or waits on one | talks to other machines |
| `env` | reads an environment variable | an input the caller may not know it is passing |
| `clock` | reads a clock: the wall clock, the monotonic clock, a file's time | output that differs from run to run |
| `entropy` | reads randomness | the same |
| `signal` | receives operating-system signals | an asynchronous input |
| `exit` | ends the process with a chosen status | skips the caller's remaining work |
| `ffi` | calls a `declare function` | C can do everything above and more, invisibly |
| `unsafe` | reserved | `nish:unsafe` has not landed; nothing carries this bit yet |

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
- **Arena control** (`Arena.*`), **`Math.*` except `random`**, the conversions,
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
| `fs.read` | `readFileSync`, `readFileSyncOrNull`, `readFileBytesSync`, `readdirSync`, `realpathSync`, `isDirectorySync` |
| `fs.write` | `writeFileSync`, `appendFileSync`, `mkdirSync` |
| `process.spawn` | `spawnSync`, `spawnSyncTo` |
| `net` | every `nish:net` export: `netAddress`, `netLocalPort`, `tcpListen`, `tcpAccept`, `netRead`, `netWrite`, `netShutdown`, `netClose`, `udpBind`, `udpSendTo`, `udpRecvFrom`, `pollCreate`, `pollAdd`, `pollModify`, `pollRemove`, `pollWait` |
| `env` | `getenv` |
| `clock` | `Date.now`, `monotonicNanos`, `statMtimeSync` |
| `entropy` | `crypto.getRandomValues`, `Math.random` |
| `signal` | `signalFd`, `readSignal` |
| `exit` | `process.exit` (and `exit` from `nish:process`) |
| `ffi` | any call to a `declare function` (no table row: it is the callee's kind) |
| `unsafe` | nothing yet |
| none | `toI32`, `toI64`, `toU8`, `toU16`, `toU32`, `toU64`, `toF32`, `toF64`, `f64ToBits`, `bitsToF64`, `ctSelect`, `ctEq`, `parseInt`, `parseFloat`, `Number`, `Ok`, `Err`, `write`, `writeError`, `panic`, `console.log`, `console.error`, `String.fromCharCode`, `Math.sqrt`, `Math.floor`, `Math.ceil`, `Math.trunc`, `Math.round`, `Math.sin`, `Math.cos`, `Math.exp`, `Math.log`, `Math.pow`, `Math.abs`, `Math.min`, `Math.max`, `Arena.reset`, `Arena.mark`, `Arena.release`, `Arena.used`, and the properties `Math.PI`, `Math.E`, `process.argv`, `process.platform`, `process.arch` |

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
bit, `CAP_NONE` (0, the deliberate none) or `CAP_UNLABELLED` (-1). The walk in
`src/attributes.ts` that meets a builtin call answering `CAP_UNLABELLED` is an
internal compiler error (exit 70, `src/ice.ts`), and `tests/capabilities.js`
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

Then `propagateCapabilities` relaxes over those edges to a fixpoint: a
function's mask is the union of its callees', and for each bit its witness is
the edge whose callee's witness is shortest, `dist + 1`. **Ties go to the
earlier site in the function's source** (the call's byte offset; every site of
one function is in one file, the one its body is written in), so the chain is
the shortest one and the report is byte-stable whatever order the program's
modules were loaded in. It terminates because bits only grow and each
`(dist, offset)` pair only shrinks, over a finite graph.

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
  `<root>`, the standard library `nish`, and a dependency by its name.
- The **program**'s set is the entry's closure: `main`'s, or, for an entry with
  no `main`, the union over the entry module's exported functions.

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

`nish run --capabilities main.ts` prints exactly one line on **stderr** before
the program runs — `capabilities: clock, fs.read (not deterministic)`, or
`capabilities: none (deterministic)` — and then runs it as usual, so stdout
stays the program's. The line is computed from the compile every run already
does, because the IR is what names the cache entry, so the flag is not part of
the run-cache key. Without `run` the same line is printed after the compile.

## 6. Cost

Measured as `src/`'s self-compile time; the figures are in the pull request and
in its `Measured:` trailer. The walk adds one table lookup per builtin call and
one edge per user call, and the relaxation is linear in the edges per round.

## 7. Out of scope

- **Enforcement** of any kind — a manifest field under `"nish"` in
  `package.json`, a `--deny` flag, a diagnostic that refuses a program. That
  is the next work package, and it reads this analysis rather than repeating
  it.
- Capability-typed handles and `using` tokens.
- Argument-level precision: which path is read, which host is dialled, taint.
- `nish:unsafe`: the bit is reserved, and labels nothing until the module
  lands.
- wasm and WASI targets beyond reporting what the program calls.
- Nondeterminism from thread scheduling or float reduction order.
- Memory-safety and undefined-behaviour facts.
- Any change to emitted IR or to an LLVM attribute.
