# Running an Nish program under Node

An Nish program is TypeScript, so a reasonable question is whether Node
can just run it. The answer is *yes, in f64 mode, within an overlap this page
states exactly* — and **no in i32 mode, ever**.

There are two different mechanisms in this repository and it matters which one
you are using:

| | What it does | Fidelity |
| --- | --- | --- |
| **The prelude** (`runtime/nish.mjs`) | Supplies the globals Nish has and Node does not. **Rewrites nothing.** | f64 mode, minus the list below |
| **The rewriter** ([wp13-differential.md](wp13-differential.md)) | Rewrote every expression from the types stage0's checker recorded. **Frozen**: it was deleted with stage0, and `tests/differential/goldens/rewrites.txt` keeps its output for the corpus ([wp19-stage0-retirement.md](wp19-stage0-retirement.md)) | Both modes, minus [`known-failures.txt`](../tests/differential/known-failures.txt) |

The rewriter was the testing oracle: it was exact because it could see the type
of every expression and turn `a + b` into `(a + b) | 0`. Its proposed successor
is `--emit ts` ([wp33-round-trip.md](wp33-round-trip.md) §4), which writes the
same translation out as TypeScript a person can keep. The prelude is the thing
you would actually hand to someone, and it is weaker because a prelude can only
replace *globals* — never operators, never the object model.

## Using it

```bash
node --experimental-strip-types --import ./runtime/nish.mjs \
  -e 'const m = await import("./prog.ts"); process.exit(m.main())'
```

The `-e` is needed because an Nish program exports `main` rather than
running anything at top level: `node … prog.ts` would load the module, never
call `main`, print nothing and exit 0. The one-liner imports the module and calls
`main` itself, which is what the native binary's entry point does, and exits
with what `main` returns (0 for a `main` that returns `void`). It is the form
`tests/differential/unmodified.js` runs. The import path is resolved from the
current directory, so keep the `./`.

The program must be an ES module to Node, which an Nish program always
is — the language has `import`/`export` and no CommonJS at all. This package is
`"type": "module"`, so an in-tree `.ts` is read that way and
`examples/nbody.ts` imports cleanly from the repository root. Under a package
that says `"type": "commonjs"`, Node reads a `.ts` as
CommonJS and `export function main` is a syntax error before type stripping
ever runs; put the program under a directory whose `package.json` says
`{ "type": "module" }`, or give it an `.mts` extension.

## What the prelude supplies

Everything delegates to `runtime/shim.mjs`, the module the differential harness
already uses, so the two cannot drift: a semantic fixed there is fixed here in
the same commit.

- `console.log` / `console.error` — `String(x)` plus a newline on a synchronous
  write. Node's own console *inspects*, so it prints `-0` where `String(-0)` is
  `0` and appends `n` to a BigInt; both would be wrong.
- `write`, `writeError`, `panic`
- `readFileSync`, `readFileSyncOrNull`, `writeFileSync`, `appendFileSync`,
  `mkdirSync`, `isDirectorySync`, `spawnSync` — globals in Nish, not
  imports from `node:fs`
- `readFileBytesSync` — `Array.from(fs.readFileSync(path))` in a `try`, a
  plain array of byte values or `null`, because a `u8[]` is a plain array here
- `dst.set(src, offset)` — the one method a plain `Array` lacks, added to
  `Array.prototype` (non-enumerable, and only when nothing got there first)
  with `TypedArray.prototype.set`'s copy-first meaning and the native
  `slice out of range` panic; `fill` needs nothing, since `Array.prototype.fill`
  already means what the language's does
  ([Bulk writes](LANGUAGE.md#bulk-writes-set-and-fill))
- `getenv` — `process.env[name] ?? null`, because Node answers `undefined`
  where the language has only `null`
- `realpathSync` — `fs.realpathSync` in a `try`, because Node throws where the
  native `realpath` answers NULL (a missing path, a loop, a component that is
  not a directory); Node's answer is already absolute and normalised, which is
  what POSIX guarantees, so nothing has to normalise it
- `toI32`, `toI64`, `toF32`, `toF64`, `toU8`…`toU64`, `f64ToBits`, `bitsToF64`
- `Ok`, `Err`
- `parseInt`, `parseFloat` — Nish's, whose deviations from JavaScript are
  documented rules
- `process.argv` — reindexed so `argv[0]` is the program on both sides
- `Arena` — no-ops, `used()` answering zero
- `nish/<module>` imports — resolved to `std/<module>.ts` beside the prelude,
  the way the compiler resolves them, so `import { parallelReduce } from
  "nish/threads"` runs as written. The standard library's bodies are the
  sequential meaning of each function and are what Node runs; they keep to
  the overlap below, which is why `std/threads.ts` computes a reduce's blocks
  in `f64` rather than `i64`

A program that declares its own function of one of these names keeps it, the
way a user function shadows a builtin in the compiler.

## What stays divergent

Each of these lives below the globals, in an operator or in the object model, so
no prelude can reach it. They are language decisions
([LANGUAGE.md](LANGUAGE.md#semantics-decisions)), not gaps to fill.

- **i32 mode entirely.** `number` is a wrapping 32-bit integer; `/` truncates
  and panics on a zero divisor; `>>>` keeps the signed reading. Every arithmetic
  operator would have to change, which is what the rewriter is for.
- **`s.length` is UTF-16 units under Node** and UTF-8 bytes natively, and so is
  every offset `charCodeAt`, `substring` and `indexOf` take or return. ASCII
  agrees; `"héllo".length` is `5` under Node and `6` natively.
- **`a[i]` is unchecked.** Out of range is `undefined` here and an exit-1 panic
  natively, and `pop()` on an empty array likewise. Only a program that goes out
  of range can tell the difference.
- **`s.slice(a, b)` clamps and takes negative indices here**, and panics
  natively outside `[0, length]`: `"abcdef".slice(2, 10)` is `cdef` under Node
  and `slice out of range: [2, 10) of length 6` natively, and `slice(-2, 6)` is
  `ef` against a panic. Unlike `a[i]`, JavaScript defines both as correct, so a
  program ported from TypeScript can depend on them. `substring` keeps
  JavaScript's clamping exactly; `slice` is the checked, faster one
  ([wp15-performance.md](wp15-performance.md) §4).
- **A record put into an array is copied natively** and shared here
  ([Arrays of records are contiguous](LANGUAGE.md#arrays-of-records-are-contiguous)).
  After `ps.push(p); p.x = 9`, `ps[0].x` is still the old value natively and
  `9` under Node, and `[p, p]` is two records natively and one object twice
  here. The reverse also holds: after `const r = ps[0]; ps[0] = q`, `r` reads
  `q`'s fields natively, because it points into the slot, and the old object
  under Node.
- **`new Array<T>(n)` has holes here.** Natively it zero-fills, and under Node
  every slot is `undefined` until written, so `a[1] + 1.0` is `1` natively and
  `NaN` here.
- **The typed-array names are plain arrays natively.** `Float64Array` is
  `f64[]` in the language, `push` and `pop` included, and under Node it is
  JavaScript's fixed-length typed array: `t.push(5.0)` is
  `TypeError: t.push is not a function`.
- **A ranged integer is unchecked.** `integer<Lo, Hi>` is an alias of `number`
  in `runtime/nish.d.ts`, so a value that leaves its range is silent here and
  an exit-1 panic natively ([wp31-ranged-integers.md](wp31-ranged-integers.md)
  §6). Only a program that leaves a range can tell the difference.
- **`orReturn()` does not propagate.** It throws a marker that the rewriter's
  `try`/`catch` turns into an early `return`; unmodified there is no `catch`, so
  it escapes as an uncaught exception. Every other part of `Result` works —
  `Ok`, `Err`, `isOk`, `isErr`, `.value`, `.error`, `unwrapOr`, `expect`.
- **`Number(s)` keeps JavaScript's parsing.** `Number` is a constructor carrying
  statics (`Number.isNaN` among them) that both Node and the prelude itself
  need, so it is left alone; it differs from Nish's on the `0b` and `0o`
  prefixes.
- **`Arena.used()` reports zero**, because there is no arena. A program printing
  it is measuring the native allocator by definition.
- **`i64` and `u64` are out**, for the same reason i32 mode is. `runtime/shim.mjs`
  represents them as BigInt — the only JavaScript type that holds 64 bits and
  wraps where the native ones wrap — and unrewritten source writes `n + 1`,
  which JavaScript refuses to mix with a BigInt. So `toI64`, `toU64` and
  `f64ToBits` throw a `TypeError` at the first arithmetic rather than answer
  something quietly wrong, which is the failure mode to want: a number that
  silently stopped wrapping at 2^53 would be much worse than a thrown error
  naming the line.
- **Node only.** The prelude installs its loader with `node:module`'s
  `registerHooks`, which Bun does not have (`Export named 'registerHooks' not
  found`), and `runtime/shim.mjs` imports `node:fs`, `node:child_process` and
  `node:os`, which a browser does not have.
  [wp33-round-trip.md](wp33-round-trip.md) §4.3 splits the runtime by host.
- **A scope's tasks run at the spawn under Node**, one after another, and each
  stores its answer there; natively they run together when the scope's block
  ends, and each answer is stored after the last task finishes
  ([LANGUAGE.md](LANGUAGE.md#scoped-tasks-using-s--scope)). A task writes
  nothing another can see and cannot print, and the checker refuses a program
  that reads a destination, or writes what a task may read, before the block
  ends, so the two print the same. `using` itself needs `--js-explicit-resource-management` on Node
  22 and is native from Node 24; Node 22's flagged `using` never calls
  `[Symbol.dispose]`, and nothing here needs it to, because every task has run
  by the time the block ends.
- **1-ulp libm differences** in `sin`/`cos`/`log`/`pow` (glibc vs V8's fdlibm),
  **`Math.min`/`Math.max` with a NaN operand** (`llvm.minnum`/`maxnum` answer the
  other operand; JavaScript answers NaN), and **`Math.round(-0.3)`** (`+0`
  natively, `-0` in JavaScript).

## What is tested

`tests/differential/unmodified.js` compiles every f64-mode program with an entry
point, runs the binary, runs the same source under Node with the prelude, and
compares stdout and exit status. Four programs are listed as divergent — each
one written to probe a decision in the list above — and any *other* difference
fails the run. It is wired into the WP13 block of `tests/run.js`:

```bash
node tests/differential/unmodified.js --verbose
```

Six `nish/threads` programs are held to the same claim by name,
`tests/link/par_map`, `tests/link/par_reduce` and the four
`tests/link/thread_scope_*`: each prints under Node, run with
`--js-explicit-resource-management`, what its native binary prints
(`node tests/run.js threads-under-node`).

Today: **7 of 11 agree, 4 known divergences, 0 unexpected.**

That ratio reads worse than it is. The f64 corpus is adversarial by
construction — `f64_libm`, `f64_minmax_nan`, `f64_round_negzero` and
`f64_i32_mixed` exist precisely to pin the places where this language and
JavaScript part company. An ordinary program does not look like them:
`examples/nbody.ts` prints byte-identical output either way.
