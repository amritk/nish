# Running an AmritScript program under Node

An AmritScript program is TypeScript, so a reasonable question is whether Node
can just run it. The answer is *yes, in f64 mode, within an overlap this page
states exactly* — and **no in i32 mode, ever**.

There are two different mechanisms in this repository and it matters which one
you are using:

| | What it does | Fidelity |
| --- | --- | --- |
| **The prelude** (`runtime/amritscript.mjs`) | Supplies the globals AmritScript has and Node does not. **Rewrites nothing.** | f64 mode, minus the list below |
| **The rewriter** ([wp13-differential.md](wp13-differential.md)) | Loads the program through the compiler's own checker and rewrites every expression from the recorded types | Both modes, minus [`known-failures.txt`](../tests/differential/known-failures.txt) |

The rewriter is the testing oracle: it is exact because it can see the type of
every expression and turn `a + b` into `(a + b) | 0`. The prelude is the thing
you would actually hand to someone, and it is weaker because a prelude can only
replace *globals* — never operators, never the object model.

## Using it

```bash
node --experimental-strip-types --import ./runtime/amritscript.mjs prog.ts
```

The program must be an ES module to Node. This repository's `package.json` says
`"type": "commonjs"`, so a `.ts` file *inside the repo* is loaded as CommonJS
and its `export function main` is a syntax error before type stripping runs;
outside it, or under a directory whose `package.json` says
`{ "type": "module" }`, it works. (`tests/differential/unmodified.js` copies each
program into such a directory for exactly this reason.)

## What the prelude supplies

Everything delegates to `runtime/shim.mjs`, the module the differential harness
already uses, so the two cannot drift: a semantic fixed there is fixed here in
the same commit.

- `console.log` / `console.error` — `String(x)` plus a newline on a synchronous
  write. Node's own console *inspects*, so it prints `-0` where `String(-0)` is
  `0` and appends `n` to a BigInt; both would be wrong.
- `write`, `writeError`, `panic`
- `readFileSync`, `readFileSyncOrNull`, `writeFileSync`, `appendFileSync`,
  `mkdirSync`, `isDirectorySync`, `spawnSync` — globals in AmritScript, not
  imports from `node:fs`
- `toI32`, `toI64`, `toF32`, `toF64`, `toU8`…`toU64`, `f64ToBits`, `bitsToF64`
- `Ok`, `Err`
- `parseInt`, `parseFloat` — AmritScript's, whose deviations from JavaScript are
  documented rules
- `process.argv` — reindexed so `argv[0]` is the program on both sides
- `Arena` — no-ops, `used()` answering zero

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
- **Method dispatch is virtual under Node**, static natively. An override
  reached through a base-typed value runs the derived method here and the base
  method natively (`tests/cases/cls_extends_override`).
- **`orReturn()` does not propagate.** It throws a marker that the rewriter's
  `try`/`catch` turns into an early `return`; unmodified there is no `catch`, so
  it escapes as an uncaught exception. Every other part of `Result` works —
  `Ok`, `Err`, `isOk`, `isErr`, `.value`, `.error`, `unwrapOr`, `expect`.
- **`Number(s)` keeps JavaScript's parsing.** `Number` is a constructor carrying
  statics (`Number.isNaN` among them) that both Node and the prelude itself
  need, so it is left alone; it differs from AmritScript's on the `0b` and `0o`
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

Today: **6 of 10 agree, 4 known divergences, 0 unexpected.**

That ratio reads worse than it is. The f64 corpus is adversarial by
construction — `f64_libm`, `f64_minmax_nan`, `f64_round_negzero` and
`f64_i32_mixed` exist precisely to pin the places where this language and
JavaScript part company. An ordinary program does not look like them:
`examples/nbody.ts` prints byte-identical output either way.
