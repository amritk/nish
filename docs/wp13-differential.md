# WP13: Differential testing against Node

**Status:** landed, then frozen. WP13 built an oracle that compiles every whole
program natively, rewrites the same program to JavaScript from the checker's
types, runs it under Node with `runtime/shim.mjs`, and compares stdout, exit
status and signal byte for byte. The rewriter (`tests/differential/rewrite.js`)
was typed by stage0's checker, so before stage0 was deleted its output was
frozen into `tests/differential/goldens/rewrites.txt` (#141, WP19 G2.4), and
the rewriter went with stage0 (#150). The comparison runs from that store
today. The language's semantics are specified in
[LANGUAGE.md](LANGUAGE.md#semantics-decisions); this page records how the
oracle works and what it found.

```
npm run test:diff                              # every program with a frozen rewrite
node tests/differential/run.js --only i64 --verbose
node tests/differential/goldens.js             # every record fresh, or registered
npm run test:node                              # f64 programs under unmodified Node
NISH_BOOTSTRAP=build/seed/bin/nish node tests/differential/fuzz.js --stage1 --count 200
```

`npm test` runs the comparison (`--quick --frozen`), the freshness check, the
unmodified-Node run (`tests/differential/unmodified.js`, the smaller claim
[RUN_UNDER_NODE.md](RUN_UNDER_NODE.md) states), and, when it has a seed, 16
fuzz programs. CI's `nish-cmp` job runs 200 fuzz programs.

## Files

| File | Role |
| --- | --- |
| `tests/differential/run.js` | The runner: discovers programs, builds the native side, runs the frozen JavaScript under Node, compares, applies `known-failures.txt`. `--frozen` is accepted and ignored now that the store is the only JavaScript |
| `tests/differential/lib.js` | Discovery, the per-program run (each in its own working directory, `cwdFor`), the pool, mismatch description |
| `runtime/shim.mjs` | The Node side of the runtime that the rewritten modules import |
| `tests/differential/goldens/rewrites.txt` | The frozen rewrites: one record per program (its `.args`, and per module the source, its SHA-256 and the id of its JavaScript), then every distinct body. 177 programs, 360 modules, 356 bodies |
| `tests/differential/goldens/unfrozen.txt` | Programs with no frozen rewrite, each with its reason. Every case added after R6 is here |
| `tests/differential/goldens.js` | Freshness: every program has a record or a register line, every record's sources still hash to what they did, no record outlives its program, and the header's counts are recomputed |
| `tests/differential/known-failures.txt` | Programs whose native behaviour differs from Node by design, each with a reason |
| `tests/differential/corpus/` | 71 hand-written programs (`<name>.ts`, or `<name>/main.ts` for several modules, with optional `.args` / `.argv`); with the entry-point cases of `tests/cases/` they are the runner's programs |
| `tests/differential/fuzz.js` | The random-program generator, now used only to compare the seed's IR with HEAD's ("The fuzzer", below) |

## How a program is compared

1. **Native.** `<compiler> <entry> -o <work>/ir/ --link <work>/app [args]`,
   the ordinary `--link` path at the speed profile; `--compiler <path>` names
   the compiler, otherwise the seed (`NISH_BOOTSTRAP`, then `build/nish`).
2. **Node.** The program's frozen `.mjs` modules and a generated
   `__entry.mjs` that calls `main()` and passes its result to `process.exit`,
   which truncates as the OS does (`300` exits `44`, `-1` exits `255`).
3. **Compare.** stdout byte for byte, exit status and signal. stderr is not a
   language feature and is not compared. (Until WP16 removed `throw`, it
   trapped with `llvm.trap`, SIGILL, and the shim raised SIGILL on itself.)

**A stale record is the one outcome no list excuses.** A program whose source
no longer hashes to what its rewrite was made from is reported `STALE` and
fails the run ahead of `known-failures.txt`, because the comparison would
otherwise hold today's binary against the JavaScript of an older program. The
hash covers every module the program loads; `.argv` and `.env` files are not
hashed because both sides receive them live, and neither is
`runtime/shim.mjs`, whose edits change what Node does and so surface as
mismatches. With no rewriter, the fix for a changed program is to move it to
`unfrozen.txt` (`goldens.js --update` does), which is coverage lost.

## Rewrite rules

The rewriter used the checker's type of each expression, not TypeScript's, so
both sides agreed on *which* semantics an expression has: a literal the checker
typed `i64` became a BigInt, an `f64` in i32 mode was left alone, and an
explicit `i32` in f64 mode still wrapped. In f64 mode nothing arithmetic was
rewritten. The rules, as the frozen store embodies them and as the helpers in
`runtime/shim.mjs` implement them:

| Construct | Rewritten to |
| --- | --- |
| `i32` `+ - / % -a`, shifts | `(… \| 0)`; `*` is `Math.imul`; `>>>` gets `\| 0` so it reads back as signed |
| `i64` / `u64` arithmetic, bitwise, shifts | `__nish.wrapI64` / `wrapU64` (`BigInt.asIntN` / `asUintN`), `shlI64`, `ashrI64`, `lshrI64`, `shlU64`, `lshrU64`; numeric literals become `123n` |
| `u8` / `u16` / `u32` | masked back to width (`& 0xFF`, `& 0xFFFF`, `>>> 0`), with shift counts masked explicitly below 32 bits |
| `f32` results and literals | `Math.fround` |
| compound assignment, `++` / `--` | the same rule on a re-read target; element targets through `__nish.updIdx`, evaluated once each |
| `a[i]`, `a[i] = v` | `__nish.idx`, `__nish.setIdx` (bounds-checked, exit 1) |
| `s.length`, `charCodeAt`, `substring`, `slice`, `indexOf`, `startsWith`, `endsWith` | `__nish.strLen` and the same-named helpers, over the UTF-8 bytes |
| `new Array<T>(n)` | `__nish.newArray(n, zero)`: zero-filled, no holes |
| `console.log`, `process.exit`, `process.argv`, `throw` | `__nish.log` (synchronous), `__nish.exit`, `__nish.argv`, `__nish.trap` |
| `Math.abs/min/max` on integers | `\| 0`, `absI64`, `minI64` / `maxI64`, `minU64` / `maxU64` |
| `toI32`, `toI64`, `toF64`, any conversion with an unsigned or `f32` side | `__nish.toI32` / `toI64` / `toF64` / `convert` (saturating from floats, wrapping between integers) |
| `parseInt`, `parseFloat`, `Number` | `__nish.parseInt` / `parseFloat` / `number`, with `strtoll` / `strtod` semantics |
| file I/O | `__nish.*` over `node:fs` |
| a derived constructor without `super(...)` | `super();` prepended |

## Semantic differences that are by design

The shim reproduces these language decisions, so they agree, unless the entry
says otherwise:

- `number` is a 32-bit integer by default. Signed overflow is a checked panic
  (#426) while the frozen rewrites wrap, so a program that overflows on purpose
  carries `--wrapping` in its `.args`; six programs written before #426 overflow
  without it and are known failures.
- `u8`/`u16`/`u32`/`u64` wrap at their width in both modes; `f32` is rounded
  with `Math.fround`; shift counts are masked to the width.
- Strings are UTF-8 bytes: `s.length` and every offset are byte counts.
  `String.fromCharCode(c)` above 127 and a `substring` cut through a
  multi-byte character produce bytes that are not a valid string; Node turns
  them into `U+FFFD` or a two-byte character where the native side prints them
  raw, so the corpus keeps those cuts on character boundaries. String
  comparison and sorting are by bytes, which agrees with JavaScript's UTF-16
  order for ASCII and can differ beyond it.
- `s.slice` panics on a range `substring` would clamp; `charCodeAt` and
  `a[i]` bounds-check and exit 1.
- An array of records holds them by value, so a corpus program must not rely
  on a pushed record and its element being the same object.
- Until WP25 removed inheritance, a method call dispatched on the receiver's
  declared type (WP2b) where Node dispatches on the runtime object, and
  `cls_extends_override` was a known failure. With no `extends`, every call
  names one method, and the difference is gone.
- Known failures by design: `Math.min`/`max` with NaN (`llvm.minnum`),
  `Math.round(-0.3)` is `+0`, and glibc's libm differs from V8's fdlibm by one
  ulp on some `sin`/`cos`/`log`/`pow` arguments (`f64_libm`: 5 of 127 values).
  Checked integer division panics where JavaScript gives `0` or `INT_MIN`.
  `integer<Lo, Hi>` range checks panic where Node has a plain `number`.
- A program that calls C through `declare function` (`ffi_scalar`,
  `ffi_pointer`) is outside this oracle permanently: its meaning is whatever
  the C function does.

## Discrepancies found

The corpus and 200 fuzz programs found no wrong instruction sequence. They
found three semantic gaps the documentation did not cover, each with a corpus
reproducer, and all three have since been resolved:

1. `Math.pow(±1, ±Infinity)` and `Math.pow(1, NaN)` returned 1 (C99 `pow`)
   where ECMAScript gives NaN. `Math.pow` now follows ECMAScript, and
   `corpus/f64_pow_spec` agrees.
2. `INT_MIN / -1` and `INT_MIN % -1` were undefined `sdiv` / `srem`: SIGFPE
   on x86-64, or a folded poison value.
3. Integer division by zero, the same mechanism.

(2) and (3) are now checked division that panics (`attempt to divide with
overflow`, `attempt to divide by zero`, exit 1), and `int_div_overflow` /
`int_div_zero` stay in `known-failures.txt` as by-design differences
([LANGUAGE.md](LANGUAGE.md#checked-integer-division)).

## The fuzzer

`tests/differential/fuzz.js` generates deterministic straight-line programs
over `i32` and `boolean`: locals from a pool of edge values (`0`, `±1`,
`2147483647`, `46341`, …), helper functions without recursion, `+ - * / %`
with every divisor through `nz(x)` (mapped into `[2, 1001]`, which rules out
discrepancies 2 and 3), `Math.abs/min/max`, comparisons, short-circuit
operators, `++`/`--` inside expressions, bounded loops, and printing. Most
programs also declare and instantiate generics (WP18). Program `i` of a run
uses seed `S + i`.

Its first mode compared each binary with Node through the live rewriter: 200
programs at seed 20260906 agreed with no mismatch. That mode went with the
rewriter, because a generated program has nothing a store could freeze. The
mode that remains, `--stage1`, compiles each program with the seed release
(`NISH_BOOTSTRAP` or `--reference`) and with HEAD and compares the IR byte for
byte, module set included, using `tests/nish-cmp.js`'s comparison; its
`DECLARED` list accepts an intended attribute or check change and fails when
an entry covers nothing. A disagreement is saved as
`build/test/differential/fuzz-stage1-fail-<seed>.ts` and reproduces with
`--seed <seed> --count 1`; `--print` writes a program without running it.

## Not in this package

- **Coverage after R6.** Every program added since has no frozen rewrite and
  no comparison with Node, and the fuzz comparison with Node is gone. The way
  back is a rewriter typed by stage1's `--emit-checked` dump
  ([wp19-stage0-retirement.md](wp19-stage0-retirement.md) §6), and it is a
  project of its own.
- **Fuzzing f64 and i64 programs**, which would have to keep NaN away from
  `Math.min/max` and `-0` away from divisions.
- **stderr comparison**, since stderr is not part of the language.
