# WP13: Differential testing against Node

A compiled Nish program must behave exactly like the same TypeScript run
under Node, up to the handful of semantic decisions this compiler documents
(32-bit `number`, byte-length strings, ...). This package proves that on a
corpus of whole programs plus a random-program fuzzer: every program is built
natively and run, rewritten to JavaScript and run under Node, and the two
runs are compared byte for byte (stdout, exit status, terminating signal).

```
npm run test:diff                       # corpus + tests/cases, table + summary
node tests/differential/run.js --only i64 --verbose
node tests/differential/fuzz.js --count 200        # random seed, printed
node tests/differential/fuzz.js --seed 20260906 --count 1
node tests/differential/fuzz.js --stage1 --count 300   # stage0 vs stage1 IR, not Node
node tests/differential/rewrite.js prog.ts         # show the JavaScript
```

`npm test` runs the same corpus (`--quick`) plus a 10-program fuzz batch with
a fixed seed as two checks in the WP13 block of `tests/run.js` (about 10 s).
The generator has a second customer in the WP14 block: `--stage1` compiles the
same random programs with both compilers and compares the IR, which is a
statement about `self/` rather than about Node ("The same programs, compiled by
both compilers", below).

## Files

| File | Role |
| --- | --- |
| `tests/differential/run.js` | The runner: discovers programs, builds and runs both sides in a process pool, prints the table, applies `known-failures.txt`. |
| `tests/differential/lib.js` | Shared pieces: discovery, `runProgram` (build, run, rewrite, run, compare), the pool, known-failure parsing, mismatch description. |
| `tests/differential/rewrite.js` | Nish -> JavaScript. Checks the program with the compiler's own checker and rewrites the AST from the recorded types. |
| `runtime/shim.mjs` | The Node side of the runtime: `toI32`/`toI64`/`toF64`, wrapping helpers, byte length, bounds-checked indexing, `console.log`, file I/O, `process.exit`, trap. |
| `tests/differential/fuzz.js` | Random integer/boolean program generator and driver: `fuzzRun` compares the binary with Node, `stage1Run` (`--stage1`) compares stage0's IR with stage1's through `tests/self/ir_oracle.js`. |
| `tests/differential/corpus/` | 50 hand-written programs (`<name>.ts` + optional `<name>.args`; multi-module ones as `<name>/main.ts` + `args`). |
| `tests/differential/known-failures.txt` | Programs whose native behaviour is known to differ; each is explained below. |

Build products live in `build/test/differential/<program>/`: `ir/` (the
`.ll` modules), `app` (the binary), `js/<module>.rewritten.ts` (the
transformed TypeScript, for reading), `js/<module>.mjs`, and `js/__entry.mjs`.

## How a program is compared

1. **Native.** `node dist/index.js <entry> -o <work>/ir/ --link <work>/app
   [args]`, i.e. the normal `--link` path (`scripts/build.sh`, speed profile,
   `-O3 -flto`). The binary runs from the repository root; stdout, stderr,
   exit status, and signal are captured. `.args` files are honoured, so
   `--number-mode f64` cases are compiled and rewritten as f64 programs.
2. **Node.** `rewrite.js` loads the same program through `dist/compiler.js`
   (`Compilation.addRoot` + `check`), so the checker records the `StaticType`
   of every expression in `CheckedProgram.types`. A `ts.transform` pass
   rewrites the AST using that table (rules below), the result is printed back
   to TypeScript, and `ts.transpileModule` strips the types into an ES module.
   Each module becomes `<stem>.mjs` (same stems as the compiler's `-o dir/`
   output); `import "./math"` becomes `import "./math.mjs"`. A generated
   `__entry.mjs` imports the entry module, calls `main()`, and passes its
   return value to `process.exit` (the C wrapper returns it from `main`, the
   OS keeps the low 8 bits, and Node's `process.exit` truncates identically:
   `300` exits `44`, `-1` exits `255`).
3. **Compare.** `stdout` must be identical bytes; exit status and signal must
   be equal. stderr is not compared (the compiler's diagnostics and the
   shim's messages are the same text, but stderr is not a language feature).
   A `throw` traps natively (`llvm.trap` -> SIGILL); the shim raises SIGILL
   on itself, so both sides report `signal: SIGILL`.

Programs are discovered from `tests/cases/*.ts` that contain `export function
main` and have no `.err` (16 today) and from the corpus (50). A program the
compiler rejects is reported as `COMPILE-ERROR` and fails the run: the corpus
must stay inside the documented language.

Using the compiler's checker for the types, rather than TypeScript's, is what
makes the rewrite exact: a literal that the checker typed `i64` by context
becomes a BigInt literal, an `f64` in i32 mode is left alone, and an explicit
`i32` local in f64 mode still wraps. Both sides therefore agree on *which*
semantics each expression has; the harness then checks that the compiled
code implements them.

## Rewrite rules

The type in the left column is the checker's type of the whole expression
(`i32` is `number` in the default mode or an explicit `i32`; `f64` is
`number` under `--number-mode f64` or an explicit `f64`). Anything not listed
is left unchanged: comparisons, `&&`/`||`/`!`, ternaries, string `+` and
`===`, template literals (a BigInt hole prints without `n`, a double hole
prints with `String(x)`, which is what `nish_str_from_f64` reproduces),
array literals, `push`, `for...of`, control flow, `Math.floor/ceil/trunc/
round/sqrt/sin/cos/exp/log/pow`, `Math.PI/E`, `Math.random`.

| Construct | Type | Rewritten to | Why |
| --- | --- | --- | --- |
| `a + b`, `a - b` | i32 | `((a + b) \| 0)` | wrap to 32 bits; the double sum of two int32s is exact, so `\| 0` is the `add i32` |
| `a * b` | i32 | `Math.imul(a, b)` | the double product can exceed 2^53, so `(a * b) \| 0` would be wrong; `imul` is the exact `mul i32` |
| `a / b` | i32 | `((a / b) \| 0)` | `sdiv` truncates toward zero |
| `a % b` | i32 | `((a % b) \| 0)` | JS `%` on integers already matches `srem`; `\| 0` normalises `-0` to `0` |
| `-a` | i32 | `((-(a)) \| 0)` | `sub i32 0, x` wraps: `-INT_MIN` is `INT_MIN` |
| `a + b`, `a - b`, `a * b`, `a / b`, `-a` | i64 | `__nish.wrapI64(a op b)` = `BigInt.asIntN(64, ...)` | BigInt is unbounded; wrap to 64 bits. BigInt `/` truncates toward zero like `sdiv` |
| `a % b` | i64 | unchanged | BigInt `%` is `srem` |
| numeric literal | i64 / u64 | `123n` | the checker typed it by context (`let x: i64 = 5`, `x * 2`, `f(5)`, `return 5`) |
| `a + b`, `a - b`, `a / b`, `a % b`, `-a` | u8 / u16 / u32 | `((a op b) & 0xFF)`, `& 0xFFFF`, `>>> 0` | JavaScript has no unsigned integers; the mask is the width. `& 0xFF` also handles a negative intermediate (ToInt32 first), and `>>> 0` is ToUint32, which is `trunc ... to i32` read as unsigned |
| `a * b` | u32 | `(Math.imul(a, b) >>> 0)` | as i32: the double product can exceed 2^53, and `mul` is bit-identical for both signednesses |
| `a op b`, `-a` | u64 | `__nish.wrapU64(a op b)` = `BigInt.asUintN(64, ...)` | as i64, but wrapped into `0 .. 2^64-1` |
| `a op b`, `-a`, `++`/`--` | f32 | `Math.fround(a op b)` | JavaScript has only doubles; every f32 result is rounded to the nearest float |
| numeric literal | f32 | `Math.fround(0.1)` | 0.1 is not a float, so the literal rounds at its source |
| `a & b`, `a \| b`, `a ^ b` | i32 / u8 / u16 / u32 | `((a op b) & mask)` | JavaScript computes these on int32 operands, which is the same bit pattern; the mask re-establishes the type |
| `a & b`, `a \| b`, `a ^ b` | i64 / u64 | `__nish.wrapI64/wrapU64(a op b)` | BigInt already agrees; the wrap is the uniform rule and cannot change an in-range result |
| `~a` | any integer | `wrap(~a)` | JS `~` on an int32 and BigInt `~` are both the `xor x, -1` we emit |
| `a << b`, `a >> b` | i32 | `((a op b) \| 0)` | JS masks the count to 31 exactly as the emitter does, and `>>` is `ashr` |
| `a >>> b` | i32 | `((a >>> b) \| 0)` | JS `>>>` yields the *unsigned* 32-bit value in a double; `\| 0` reads those bits back as the signed `i32` Nish has ([LANGUAGE.md, Semantics decisions](LANGUAGE.md#semantics-decisions)) |
| `a << b` | u8 / u16 / u32 | `((a << (b & w)) & mask)` | the count mask is spelled out below 32 bits, where JavaScript's own mask of 31 is too wide |
| `a >> b`, `a >>> b` | u8 / u16 / u32 | `((a >>> (b & w)) & mask)` | `>>` is `lshr` on an unsigned type, which is JavaScript's `>>>` |
| `a << b`, `a >> b`, `a >>> b` | i64 | `__nish.shlI64/ashrI64/lshrI64(a, b)` | BigInt shifts do not mask the count and BigInt has no `>>>` at all |
| `a << b`, `a >> b`, `a >>> b` | u64 | `__nish.shlU64/lshrU64(a, b)` | the same, with the unsigned wrap; a u64 is non-negative, so BigInt `>>` is already logical |
| `x += e` etc. | any integer | `x = <a op b rule>` | the target is a local or a field, both of which are re-read rather than re-evaluated, so spelling `x` twice is safe; an element target has its own row below |
| `x &= e`, `x \|= e`, `x ^= e`, `x <<= e`, `x >>= e`, `x >>>= e` | any integer | `x = <a op b rule>` | the same, with the bitwise rules above |
| `++x`, `--x` | any integer | `(x = wrap(x + 1))` | |
| `x++`, `x--` | any integer | `wrap((x = wrap(x + 1)) - 1)` | the old value, recovered with wrapping arithmetic so `INT_MAX++` works |
| `a[i]` read | any | `__nish.idx(a, i)` | WP4 bounds check: out of range prints `index out of range: i >= len` to stderr and exits 1; negative indices fail like the unsigned compare; a double index is truncated like `fptosi` |
| `a[i] = v` | any | `__nish.setIdx(a, i, v)` | evaluates `a`, `i`, `v`, then checks and stores; yields `v` |
| `a[i] op= v` | any numeric, and any integer for the bitwise forms | `__nish.updIdx(a, i, (old) => <old op v rule>)` | evaluates `a`, `i`, checks, loads, evaluates `v`, computes, stores — once each, which is what `corpus/bit_compound_target` counts |
| `s.charCodeAt(i)`, `s.substring(a, b)`, `s.slice(a, b)`, `s.indexOf(sub)`, `s.startsWith(p)`, `s.endsWith(p)` | receiver string | `__nish.<name>(s, ...)` | every offset is a UTF-8 byte offset, which JavaScript's own methods do not use; `slice` panics on a range the string does not contain instead of clamping |
| `s.length` | receiver string | `__nish.strLen(s)` = `Buffer.byteLength(s, "utf8")` | UTF-8 byte length. Arrays keep `.length` |
| `new Array<T>(n)` | | `__nish.newArray(n, 0 \| 0n \| false)` | zero-filled, no holes |
| `console.log(x)` | | `__nish.log(x)` | `String(x)` + newline via `fs.writeSync(1)`: no `n` suffix on BigInt, synchronous so `process.exit` cannot lose it |
| `process.exit(c)` | | `__nish.exit(c)` | |
| `throw e` | | `__nish.trap()` | SIGILL, like `llvm.trap` |
| `Math.abs(x)` | i32 | `(Math.abs(x) \| 0)` | `llvm.abs.i32(x, false)`: `abs(INT_MIN)` is `INT_MIN` |
| `Math.abs(x)` | i64 | `__nish.absI64(x)` | same, 64-bit |
| `Math.abs(x)` | unsigned | the argument alone | the value is already its own magnitude, and `Math.abs` throws on a BigInt |
| `Math.min/max(a, b)` | i64 | `__nish.minI64/maxI64` | `Math.min` rejects BigInt |
| `Math.min/max(a, b)` | u64 | `__nish.minU64/maxU64` | same |
| `toI32(x)` | | `__nish.toI32(x)` | BigInt: wrap (`trunc`); double: saturate, NaN -> 0 (`llvm.fptosi.sat`) |
| `toI64(x)` | | `__nish.toI64(x)` | int32: exact (`sext`); double: truncate and saturate |
| `toF64(x)` | | `__nish.toF64(x)` | `Number(bigint)` rounds to nearest like `sitofp` |
| any `toX(y)` with an unsigned type or an `f32` on either side | | `__nish.convert(y, "<from>", "<to>")` | one helper for the whole matrix: the value becomes an exact BigInt, then `BigInt.asIntN`/`asUintN` at the target's width performs the `sext`, `zext` or `trunc`. From a float it saturates like `llvm.fpto{s,u}i.sat`; to an `f32` it is `Math.fround` |
| `readFileSync`, `writeFileSync`, `appendFileSync` | | `__nish.*` over `node:fs` with UTF-8 | a failure prints `nish: cannot read <path>` and exits 1 |
| derived-class constructor without `super(...)` | | `super();` prepended to the body | Nish calls the (parameterless) ancestor constructor implicitly (WP2b); JavaScript throws at the first `this` without an explicit call |
| `process.argv` | | `__nish.argv()` = `process.argv.slice(1)` | index 0 is the program on both sides (the executable natively, the rewritten entry script under Node); the arguments come from `<name>.argv` next to the program and are passed to both runs |
| `parseInt(s)` | | `__nish.parseInt(s)` | base-10 `strtoll` semantics (ASCII whitespace, sign, digits; no `0x`) then `toI32` saturation, 0 without digits |
| `parseFloat(s)` | | `__nish.parseFloat(s)` | longest decimal literal or `Infinity` after ASCII whitespace; a `0x` prefix is read as hex like `strtod` (JS gives 0) |
| `Number(x)` | | `__nish.number(x)` | strings: one literal bar ASCII whitespace, blank is 0, `0x` hex accepted, no `0b`/`0o`; BigInt and booleans convert numerically |

A user function named like a builtin (`toI32`, `readFileSync`) shadows it in
the checker (`callees` has the call), and the rewrite follows that.

In f64 mode nothing arithmetic is rewritten: JavaScript `+ - * / %` on
doubles *are* `fadd/fsub/fmul/fdiv/frem`, and `Math.*` on doubles are the
same IEEE operations (see the libm note below for the exceptions).

## Semantic differences that are by design

These are language decisions, documented elsewhere, that the shim reproduces
so they do not show up as mismatches (or, for the last three, that stay
visible as known failures):

- **`number` is a 32-bit integer** in the default mode
  ([LANGUAGE.md, Semantics decisions](LANGUAGE.md#semantics-decisions)):
  `7 / 2` is `3`, `-7 / 2` is `-3`, `-7 % 3` is `-1`. Since WP15 §3, signed
  overflow is *undefined* rather than wrapping, and the shim has no way to
  reproduce undefined behaviour, so **a corpus program that overflows on
  purpose carries `--wrapping` in its `.args`** — only then does
  `2147483647 + 1` mean `-2147483648` on both sides. Comparing a wrapping
  JavaScript rewrite against a native binary that was allowed to assume the
  overflow never happens would be testing nothing at all. The programs that
  carry the flag are `int_wrap`, `int_literal_edges`, `int_incdec`,
  `int_compound`, `i64_arith`, `conversions_roundtrip`, `digits`, `recursion`,
  `bool_logic`, `bit_fnv1a`, `prng_lcg` and `const_module`.
- **`i64` wraps at 64 bits under `--wrapping`**, and is undefined on overflow
  without it; literals are typed by context (docs/wp7-runtime.md).
- **Shift counts are masked** to the operand width — 31 at 32 bits and 63 at
  64, which is what JavaScript does too, so `x << 33` agrees on both sides; the
  rewrite spells the mask out only for `u8` and `u16`, whose widths JavaScript
  has no operator for. **`>>>` on `i32` keeps the signed reading**: `-1 >>> 0`
  is `-1` here and `4294967295` in JavaScript, so the rewrite appends `| 0`
  ([LANGUAGE.md, Semantics decisions](LANGUAGE.md#semantics-decisions);
  `corpus/bit_shifts`, `corpus/bit_fnv1a`).
- **`f32` is a 32-bit float** and JavaScript has only doubles, so every `f32`
  result is rounded with `Math.fround`: `const tenth: f32 = 0.1` prints
  `0.10000000149011612` (`corpus/f32_round`).
- **`u8`/`u16`/`u32`/`u64` are unsigned and wrap at their width**, in both
  overflow modes, so an unsigned program needs no `--wrapping`
  ([LANGUAGE.md, Unsigned integers](LANGUAGE.md#unsigned-integers)):
  `(255: u8) + 1` is `0`, a `u32` above `INT_MAX` divides and compares as the
  positive value it is, and `>>` is a logical shift. JavaScript has no
  unsigned integers at all, so the rewrite masks each result back into its
  width (`corpus/u_wrap`, `u_div_cmp`, `u_convert_shift`).
- **`s.length` is the UTF-8 byte length** (docs/wp3-strings.md): `"héllo".length`
  is `6`, `"🎉".length` is `4`. So is every offset the string methods take or
  return (WP14 A2): the shim runs `charCodeAt`, `substring`, `slice`,
  `indexOf`, `startsWith` and `endsWith` over `Buffer.from(s, "utf8")` rather
  than over the JavaScript string, so `"héllo".charCodeAt(1)` is `195`, the
  first byte of `é`, on both sides (`corpus/str_methods`, `corpus/str_slice`).
- **`s.charCodeAt(i)` bounds-checks** and exits 1, where JavaScript answers
  `NaN`, which an `i32` cannot hold; `String.fromCharCode(c)` builds the
  one-byte string of `c & 0xFF`. A code above 127 is therefore one byte that
  is not valid UTF-8 on its own, which a JavaScript string cannot represent —
  the shim produces the two bytes of the same code point instead, so the
  corpus keeps `String.fromCharCode` to ASCII. `substring` has the same edge:
  a cut through the middle of a multi-byte character leaves bytes that are not
  a valid string, and Node replaces them with `U+FFFD` where the native side
  prints them raw, so `corpus/str_methods` cuts on character boundaries.
- **`s.slice(a, b)` refuses what `substring` clamps** (WP15 §4): JavaScript
  counts a negative offset from the end and answers `""` for a reversed pair,
  and `slice` panics with `slice out of range: [a, b) of length len` in both
  of those cases. The shim panics the same way, so `cases/str_slice_panic`
  agrees rather than being a known difference; what the corpus compares is the
  in-range, non-negative half, where the two are byte for byte the same.
- **`toI32`/`toI64` from a double saturate** (`toI32(5e10)` is `2147483647`,
  `toI32(NaN)` is `0`), unlike JavaScript's `ToInt32`; integer-to-integer
  conversions wrap (docs/wp7-runtime.md).
- **`new Array<T>(n)` zero-fills**; there are no holes.
- **`a[i]` is bounds-checked** and exits 1 on failure.
- **`throw` traps** (SIGILL) instead of unwinding.
- **Method calls dispatch on the receiver's declared type** (WP2b,
  [LANGUAGE.md, Classes](LANGUAGE.md#classes)): with `class Square extends
  Shape` overriding `area`, `areaOf(s: Shape)` calls `Shape.area` on a
  `Square` natively but `Square.area` under Node, which looks the method up
  on the runtime object. Programs without overrides agree (`corpus/class_inheritance`);
  `cases/cls_extends_override` exercises the override and is a known failure.
- **`Math.min`/`Math.max` on doubles use `llvm.minnum`/`maxnum`**, which
  return the non-NaN operand when the other is NaN; JavaScript returns NaN
  (docs/wp7-runtime.md). Corpus: `f64_minmax_nan` (known failure).
- **`Math.round` never returns `-0`**: `Math.round(-0.3)` is `+0`, JavaScript
  gives `-0`. Both print `0`; `1 / Math.round(-0.3)` shows the sign
  (docs/wp7-runtime.md). Corpus: `f64_round_negzero` (known failure).
- **`Math.sin/cos/exp/log/pow` call glibc's libm** (LLVM intrinsics lower to
  `sin`, `cos`, ...), while V8 ships its own fdlibm port. Both are within one
  ulp of the true result and they usually agree, but not always. Corpus:
  `f64_libm` (known failure), 5 of 127 printed values differ:

  | Expression | native (glibc 2.39) | Node 22 |
  | --- | --- | --- |
  | `Math.sin(2.5)` | `0.5984721441039565` | `0.5984721441039564` |
  | `Math.sin(-2.5)` | `-0.5984721441039565` | `-0.5984721441039564` |
  | `Math.cos(0.1)` | `0.9950041652780258` | `0.9950041652780257` |
  | `Math.log(3)` | `1.0986122886681098` | `1.0986122886681096` |
  | `Math.pow(1.1, 100)` | `13780.61233982238` | `13780.612339822383` |

  `Math.sqrt` is exact on both sides (IEEE). The corpus programs that print
  transcendental results elsewhere only use arguments with exact results
  (`exp(0)`, `pow(2, 10)`, `sin(0)`, ...).

## Discrepancies found

Nothing in the corpus or in 200 fuzz programs exposed a wrong instruction
sequence: every integer, string, array, i64, conversion, formatting, I/O, and
control-flow program agrees with Node. The harness did surface three
semantic gaps between "what JavaScript does" and "what the compiled code
does" that the documentation did not cover. None was fixed here (WP13 does
not touch compiler sources); each is a known failure with a corpus
reproducer.

*Since this note was written:* (1) is fixed, `Math.pow` now follows
ECMAScript and `f64_pow_spec` agrees with Node; (2) and (3) are resolved by
checked integer division, which panics (`attempt to divide with overflow`
/ `attempt to divide by zero`, exit 1) instead of executing undefined
`sdiv`/`srem`. The two division programs stay in `known-failures.txt` as
by-design differences from JavaScript's `0`
([LANGUAGE.md: Checked integer division](LANGUAGE.md#checked-integer-division)).

### 1. `Math.pow(±1, ±Infinity)` and `Math.pow(1, NaN)` return 1, not NaN

`tests/differential/corpus/f64_pow_spec.ts` (`--number-mode f64`):

```ts
const z = 0;
const inf = 1 / z;
const nan = z / z;
console.log(Math.pow(1, inf));    // native 1, Node NaN
console.log(Math.pow(-1, inf));   // native 1, Node NaN
console.log(Math.pow(1, nan));    // native 1, Node NaN
console.log(Math.pow(nan, 0));    // 1 on both
```

`llvm.pow.f64` has C99 `pow` semantics, where `pow(1, y)` is `1` for every
`y` and `pow(-1, ±∞)` is `1`; ECMA-262 `Math.pow` (Number::exponentiate)
specifies NaN for `base` of `±1` with an infinite exponent and for any NaN
exponent. Every other special case checked (`pow(0, -1)`, `pow(-0, -1)`,
`pow(2, ∞)`, `pow(0.5, ∞)`, `pow(-2, ∞)`, `pow(∞, 0)`, `pow(NaN, 0)`)
agrees. A fix is a compare-and-select before the intrinsic call, or a note
in docs/wp7-runtime.md next to the `minnum` decision.

### 2. `INT_MIN / -1` and `INT_MIN % -1` are undefined behaviour

`tests/differential/corpus/int_div_overflow.ts`:

```ts
const min = -2147483647 - 1;
const d = toI32(Math.random()) - 1;   // -1, but opaque to LLVM
console.log(min / d);                 // Node: -2147483648; native: SIGFPE
console.log(min % d);                 // Node: 0
```

The emitter lowers `/` and `%` to plain `sdiv`/`srem`, which LLVM defines as
undefined for this input. On x86-64 the `idiv` instruction raises `#DE`, so
the binary dies with SIGFPE after printing `d = -1`. When the operands are
constants LLVM folds the poison instead: with `let d = 1; d -= 2;` the same
program printed `-1` for both lines and exited 0. JavaScript (and the
rewrite, `(min / d) | 0`) gives `-2147483648` and `0`. Rust in release mode
panics here rather than wrapping; the wrapping the README used to promise
never covered division anyway, and since WP15 §3 it does not promise wrapping
at all without `--wrapping`. The i64 case is identical.

### 3. Integer division by zero is undefined behaviour

`tests/differential/corpus/int_div_zero.ts`:

```ts
const z = toI32(Math.random());       // 0, but opaque to LLVM
console.log(7 / z);                   // Node: 0 (Infinity | 0); native: SIGFPE
console.log(7 % z);                   // Node: 0 (NaN | 0)
```

Same mechanism as (2). JavaScript's `Infinity | 0` and `NaN | 0` are both
`0`, so under the i32 reading of `number` the program has a defined answer
that the binary does not produce. With a constant zero divisor LLVM folded
the poison to `0`, which happens to match. A checked division (`b === 0`
-> trap or defined result) is the obvious fix; the fuzzer avoids the case by
routing every divisor through `nz(x)` (see below).

### Observations that are not bugs

Writing the corpus also ran into checker and validator limits worth knowing
when reading a `COMPILE-ERROR` row:

- Contextual literal typing applies only to the literal itself: `const f:
  f64 = 0.1 + 0.2`, `const f: f64 = c ? 1.5 : -1.5`, `toI64(1e18)`,
  `toI32(2.5)`, and `` `${1e21}` `` are all rejected in i32 mode; write the
  value into an annotated local first (`const e18: f64 = 1e18`).
- The i64 literal bound is exclusive: `const big: i64 = 9007199254740992`
  (exactly 2^53, representable) is rejected with "exceeds 2^53" although
  docs/wp7-runtime.md says `|n| <= 2^53`. Cosmetic; `let big: i64 =
  4503599627370496; big = big * 2` works.
- The validator's numeric-index shape check rejects `a[k++]` and `a[--k]`
  as "Element access requires a numeric index" before the checker sees them.
- `n *= i` with an `i64` `n` and an i32 loop variable needs `toI64(i)`;
  there is no implicit widening (documented).

## The fuzzer

`tests/differential/fuzz.js` generates programs over `number` (i32) and
`boolean`:

- 3 to 6 integer locals initialised from a literal pool that includes `0`,
  `±1`, `2147483647`, `-2147483647`, `2147483646`, `46341` (the smallest
  integer whose square overflows), `65536`, `1000000000`, and uniformly
  random 32-bit values; 1 to 3 boolean locals.
- 1 to 3 helper functions `h<n>(a, b)` with an optional `if`; a helper may
  call only lower-numbered helpers, so there is no recursion.
- Expressions (depth-bounded, default 3): `+ - * / %`, unary minus,
  `Math.abs/min/max`, comparisons, `&& || !`, ternaries, helper calls, and
  `x++`/`--x` on locals *inside* expressions (side effects in short-circuit
  operands and evaluation order).
- Statements (8 to 16 in `main`): assignments, compound assignments,
  `++`/`--`, `if/else`, `for` loops of 1 to 8 iterations, counted `while`
  loops with an optional `continue`, and `console.log` of numbers, booleans,
  and template literals. Every local is printed at the end.
- Every divisor is `nz(e)`, a helper that maps any value into `[2, 1001]`,
  which rules out division by zero and `INT_MIN / -1` (see discrepancies 2
  and 3). `Math.abs(INT_MIN)` and every other wrap is fair game.

A generated program is parsed with the TypeScript parser before it is used,
and the seed is re-rolled while the text has a syntax error. Only one shape
triggers this: the `a < b > (c)` ambiguity, where TypeScript reads the `<`
of a comparison as the start of a type-argument list. `tsc` rejects such a
program at exactly the positions `nish` reports, so it compares nothing
(seed 4277 produced one before the re-roll existed). Re-rolling is
deterministic per seed, so a saved failure still reproduces.

Program `i` of a run uses seed `S + i`; the seed is printed at the start and
end of every run, and a mismatching or non-compiling program is saved as
`build/test/differential/fuzz-fail-<S + i>.ts`. `--seed <S + i> --count 1`
reproduces it; `--print` writes the program to stdout without running it.

Results: `node tests/differential/fuzz.js --seed 20260906 --count 200`
completed with 0 mismatches and 0 compile errors (52 s on 4 cores). The
`tests/run.js` block runs seeds `20260906..20260915`.

### The same programs, compiled by both compilers

`--stage1` points the generator at the *other* differential question (WP14):
not "does the binary behave like Node" but "do the two compilers emit the same
IR". Each generated program is compiled by stage0 and by the self-hosted
compiler and the two texts are compared byte for byte, module set included —
the equality `tests/self/ir_oracle.js` asserts over the checked-in corpus,
here on programs neither compiler has ever seen. stage0 is the oracle: there
is no golden in this path, and a stage1 rejection of a program stage0 accepts
counts as a disagreement rather than a skip.

The mode reuses `ir_oracle.js`'s `build` and `compare` rather than repeating
them, and links the stage1 binary once per run (about 15 s), after which each
program costs about a third of a second. It is a separate mode, not a
replacement: the default run still compares stage0 against Node and knows
nothing about `self/`.

```
node tests/differential/fuzz.js --stage1 --count 300            # random seed, printed
node tests/differential/fuzz.js --stage1 --seed 20261001 --count 1
```

A disagreement saves the program as
`build/test/differential/fuzz-stage1-fail-<S + i>.ts` and prints the reproduce
command with its seed and the first differing line. Results:
`--stage1 --seed 20261001 --count 300` agreed on every byte of every module —
300 of 300 programs, 141,098 lines of IR, 108 s. The WP14 block of
`tests/run.js` runs 16 programs from the same seed (about 20 s, most of it the
one link), sized so `npm test` keeps its shape; see `docs/wp14-selfhost.md` §4.

## Runner options and conventions

- `--only <s>` runs programs whose name contains `<s>` (`cases/arr_`,
  `corpus/i64`, ...); `--corpus-only` / `--cases-only` narrow the set;
  `--jobs N` sets the pool size (default: CPU count, at most 8);
  `--quick` skips corpus programs named `slow_*` (none yet; the hook exists
  for the `npm test` time budget); `--verbose` prints both outputs of every
  mismatch.
- `known-failures.txt`: one program name per line, `#` comments. A listed
  program that mismatches is `KNOWN mismatch` and does not fail the run; one
  that agrees is `XPASS` (also non-fatal) and should be removed from the
  list. `--update-known` rewrites the file from the current results (it
  drops the per-line comments; restore them by hand).
- A corpus program needs `export function main` and must be deterministic.
  `Math.random()` is only used where its value is forced (`toI32` of a value
  in `[0, 1)`), and file I/O uses paths under `build/test/differential/`.
- The multi-module form is `corpus/<name>/main.ts` plus its imports and an
  optional `args` file; the runner passes `-o <work>/ir/` so each module gets
  its own `.ll`.

## Corpus

| Program | Exercises |
| --- | --- |
| `int_wrap`, `int_literal_edges`, `prng_lcg` | wrapping at 2^31 for `+ - *`, unary minus, factorials, an LCG (all three `--wrapping`) |
| `int_divmod`, `int_div_overflow`, `int_div_zero` | truncating division and remainder with every sign combination; the two undefined cases |
| `int_abs_minmax` | `Math.abs(INT_MIN)`, `min`/`max`, clamp |
| `int_incdec`, `int_compound` | prefix/postfix `++`/`--` in expressions, `op=` on locals and elements |
| `bit_ops`, `bit_shifts`, `bit_i64`, `bit_fnv1a` | `& \| ^ ~` on both signs and both ends of the range, the three shifts at counts 0 to 40 and below zero, `-1 >>> 0`, the i64 forms through the BigInt shim, and an FNV-1a hash loop |
| `digits`, `collatz`, `recursion` | loops and recursion (fib, ackermann(3, 5), power by squaring, mutual recursion) |
| `f64_format` | `0.1 + 0.2`, `1e21`, `1e-7`, `2^53 ± 1`, `-0`, `5e-324`, `1.7976931348623157e308`, `Infinity`, `NaN` |
| `f64_math`, `f64_arith`, `f64_libm`, `f64_pow_spec`, `f64_round_negzero`, `f64_minmax_nan` | floor/ceil/trunc/round on negatives and halves, `%` on doubles, transcendental functions, pow special cases |
| `f64_i32_mixed` | explicit `i32` under `--number-mode f64`, saturation |
| `str_basic`, `str_unicode`, `str_nul_escapes`, `str_template`, `str_build_loop`, `str_large` | concat, equality (including embedded NUL bytes), byte lengths of multi-byte text, every hole type, arena growth past 64 KB |
| `loops_nested`, `loops_break_continue`, `scopes_shadow` | sieve, break/continue in every loop form, block shadowing |
| `arr_sort_reverse`, `arr_push_growth`, `arr_2d`, `arr_bounds_edge`, `arr_for_of`, `arr_oob_exit`, `arr_oob_negative` | bubble sort, in-place reverse, 5000 pushes, matrices, `a[a.length - 1]`, push during `for...of`, the two panic paths |
| `ternary_chain`, `short_circuit`, `bool_logic` | nested ternaries of every type, side effects in `&&`/`||`, truth tables, NaN comparisons |
| `i64_arith`, `conversions_roundtrip` | wrapping at 2^63, negative `/` and `%`, `abs`/`min`/`max`, every `toI32/toI64/toF64` direction, `2^53 + 1` rounding |
| `io_roundtrip`, `io_missing_file` | write/append/read, truncation, UTF-8 bytes, the missing-file exit |
| `exit_code`, `exit_code_large`, `main_return_code`, `main_return_negative`, `throw_trap` | `process.exit(21)`, `process.exit(300)` -> 44, `return 42`, `return -1` -> 255, SIGILL |
| `modules_basic/`, `modules_diamond/` | named imports with `as`, a diamond, and an import cycle back into `main.ts` |

## Not in this package

- **Fuzzing f64 and i64 programs.** The generator only covers the i32/boolean
  subset the brief asked for. An f64 generator would have to keep NaN away
  from `Math.min/max` and `-0` away from divisions (both by-design
  differences) to stay useful; an i64 generator needs `toI64` around every
  literal that is not in a typed context.
- **stderr comparison.** The panic and I/O messages match today, but stderr
  is not part of the language, so it is not compared.
- **A rewrite of `a[k++]`.** Not needed: the validator rejects it.
- **Fixing the three discrepancies.** They were in `src/codegen/emit/math.ts`
  (`pow`) and `src/codegen/emit/expressions.ts` (`sdiv`/`srem`), owned by
  other packages; all three were addressed afterwards (see the note under
  "Discrepancies found"), with `emit/arithmetic.ts` now holding the checked
  division.
