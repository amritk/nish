# WP28 spike S5: the price of `--number-mode f64` on the benchmark suite

`--compat` implies `--number-mode f64`
([docs/wp28-compatibility-mode.md](../../docs/wp28-compatibility-mode.md), §5.3),
so whatever that flag costs is part of what `--compat` costs. This spike
builds every program `bench/run.mjs` lists both ways and measures the
difference.

```sh
npm run build                          # build/nish
node bench/wp28-s5/run.mjs             # all 34 programs, about 25 minutes
node bench/wp28-s5/run.mjs --quick     # fib, nbody, par-single: one of each outcome
```

`--rounds <n>` sets the timed rounds (7, or 3 under `--quick`) and
`--compiler <nish>` names another compiler. The program list is read out of
`bench/run.mjs`'s source, so a program added there is measured here.

## The price

**On the 14 suite programs that compile under it, `--number-mode f64` costs
nothing measurable: 1.008x geometric mean over the 10 that were timed, each
inside or at the edge of its noise band but one, and at most +0.03%
instructions. On integer-heavy code the suite cannot price it at all: the
other 20 programs are refused by the checker.**

So the sentence §5.3 was expected to get, "`--compat` costs N× on
integer-heavy code, within noise on the rest", has no N from this suite. What
the suite supports is: **`--compat` is within noise on code whose integers are
spelled `i32`, and code that leaves an integer as a bare `number` beside an
`i32` does not compile under it until it is ported.** The price of
`--number-mode f64` on such code is a porting cost before it is a run-time
one, and the run-time one needs ported programs to measure, which is outside
this spike.

Three things qualify the figures:

- **The timed set is narrow.** All ten are the `par-*` kernels, timed as
  their sequential loop (`seq`). They compile because their loops are written
  `let i: i32`, which is also why the mode does not reach their hot code. No
  program in the suite does integer arithmetic in a bare `number` and still
  compiles under f64, so the case a JavaScript author would hit, a `for`
  loop counting in doubles, is not measured here.
- **par-heavy-fold reads "slower" (1.053x against a ±4.3% band) and is not.**
  Its two binaries execute the same instructions to within 1237 of 29.9
  billion, and its minimum is 1.032x against ±1.7% on a machine where the
  same row's neighbours (`par-heavy`, the same kernel without the fold) sit at
  1.007x. Seven rounds of a 2.5 s program on a shared 4-core VM under-state
  the band; the instruction count is the steadier witness and says no
  difference.
- **One machine, one run.** The band is each binary against a byte-identical
  copy of itself in the same interleaved rounds
  ([.claude/testing.md](../../.claude/testing.md), "A `Measured:` trailer").

## The run

34 programs under `--number-mode f64` against the suite's own build: 10 timed, 4 with the same IR, 20 refused, 0 with a changed output.

Machine: 4 x Intel(R) Xeon(R) Processor @ 2.10GHz, linux-x64, nish 0.38.0 at 6c00dc98, node v22.23.4. 7 interleaved rounds after one warm-up.

### Timed

Ratio is f64 over the default, on the median; the band is the larger gap between a binary and its byte-identical copy in the same rounds.

| program | default (ms) | f64 (ms) | ratio | band | reading | ratio (min) | band (min) | instructions | IR lines changed, `%N` masked |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| par-compute | 964 | 984 | 1.021x | ±2.3% | within the band | 1.007x | ±1.4% | +0.00% † | 46 |
| par-nbody | 195 | 198 | 1.019x | ±3.8% | within the band | 1.003x | ±1.0% | +0.03% † | 76 |
| par-short | 73.9 | 68.4 | 0.927x | ±8.3% | within the band | 1.036x | ±3.3% | -0.00% † | 45 |
| par-regions | 653 | 647 | 0.990x | ±7.7% | within the band | 1.031x | ±1.1% | -0.00% † | 52 |
| par-histogram | 32.7 | 33.7 | 1.028x | ±8.4% | within the band | 0.978x | ±6.9% | +0.00% † | 23 |
| par-heavy | 2591 | 2609 | 1.007x | ±0.3% | at the band's edge | 1.005x | ±4.8% | +0.00% † | 60 |
| par-heavy-fold | 2491 | 2622 | 1.053x | ±4.3% | slower | 1.032x | ±1.7% | +0.00% † | 60 |
| par-heavy4 | 12689 | 12808 | 1.009x | ±0.6% | at the band's edge | 1.005x | ±0.9% | +0.00% † | 60 |
| par-scale | 376 | 377 | 1.002x | ±3.1% | within the band | 1.017x | ±3.3% | +0.00% † | 60 |
| par-single | 233 | 240 | 1.030x | ±3.7% | within the band | 1.027x | ±2.2% | +0.00% † | 57 |

Geometric mean of the 10 timed ratios: 1.008x on the median, 1.014x on the minimum; with the 4 same-IR programs at 1.000x, 1.006x on the median.
Outside its band on the median: par-heavy-fold (slower).

Instructions are f64 against the default under cachegrind, whole process, pinned as `node bench/run.mjs --instructions` pins them. † marks a program bench/instructions.json does not have, counted at its source's own size.
- par-compute: 905884291 default, 905884334 f64
- par-nbody: 1183134396 default, 1183430687 f64
- par-short: 521315972 default, 521315945 f64
- par-regions: 8258089434 default, 8258089418 f64
- par-histogram: 103386270 default, 103386270 f64
- par-heavy: 30278641374 default, 30278642426 f64
- par-heavy-fold: 29859211492 default, 29859212729 f64
- par-heavy4: 94199834161 default, 94199834892 f64
- par-scale: 2765579869 default, 2765580574 f64
- par-single: 700625590 default, 700625598 f64

### Same IR

The sidecar already builds these with `--number-mode f64`, so the flag changes nothing. Each command prints nothing:

```
diff -r build/bench/wp28-s5/nbody/default/ir build/bench/wp28-s5/nbody/f64/ir
diff -r build/bench/wp28-s5/spectral/default/ir build/bench/wp28-s5/spectral/f64/ir
diff -r build/bench/wp28-s5/vec3/default/ir build/bench/wp28-s5/vec3/f64/ir
diff -r build/bench/wp28-s5/math/default/ir build/bench/wp28-s5/math/f64/ir
```

### Refused

| program | source | errors | by code | first diagnostic |
| --- | --- | ---: | --- | --- |
| fib | bench/fib.ts | 1 | NL2140 x1 | bench/fib.ts:10: `main` must return void or an i32 number (the process exit code), not f64; under --number-mode f64 declare `main(): i32` |
| sieve | bench/sieve.ts | 1 | NL2140 x1 | bench/sieve.ts:26: `main` must return void or an i32 number (the process exit code), not f64; under --number-mode f64 declare `main(): i32` |
| strbuild | bench/strbuild.ts | 1 | NL2140 x1 | bench/strbuild.ts:31: `main` must return void or an i32 number (the process exit code), not f64; under --number-mode f64 declare `main(): i32` |
| result | bench/result.ts | 1 | NL2140 x1 | bench/result.ts:29: `main` must return void or an i32 number (the process exit code), not f64; under --number-mode f64 declare `main(): i32` |
| Permute | bench/awfy/main.ts | 23 | NL2100 x10, NL2178 x2, NL2117 x8, NL2236 x2, NL2231 x1 | bench/awfy/main.ts:60: Operator `<` requires two numeric operands, got f64 and i32 |
| Queens | bench/awfy/main.ts | 23 | NL2100 x10, NL2178 x2, NL2117 x8, NL2236 x2, NL2231 x1 | bench/awfy/main.ts:60: Operator `<` requires two numeric operands, got f64 and i32 |
| Towers | bench/awfy/main.ts | 23 | NL2100 x10, NL2178 x2, NL2117 x8, NL2236 x2, NL2231 x1 | bench/awfy/main.ts:60: Operator `<` requires two numeric operands, got f64 and i32 |
| List | bench/awfy/main.ts | 23 | NL2100 x10, NL2178 x2, NL2117 x8, NL2236 x2, NL2231 x1 | bench/awfy/main.ts:60: Operator `<` requires two numeric operands, got f64 and i32 |
| Bounce | bench/awfy/main.ts | 23 | NL2100 x10, NL2178 x2, NL2117 x8, NL2236 x2, NL2231 x1 | bench/awfy/main.ts:60: Operator `<` requires two numeric operands, got f64 and i32 |
| Mandelbrot | bench/awfy/main.ts | 23 | NL2100 x10, NL2178 x2, NL2117 x8, NL2236 x2, NL2231 x1 | bench/awfy/main.ts:60: Operator `<` requires two numeric operands, got f64 and i32 |
| Storage | bench/awfy/main.ts | 23 | NL2100 x10, NL2178 x2, NL2117 x8, NL2236 x2, NL2231 x1 | bench/awfy/main.ts:60: Operator `<` requires two numeric operands, got f64 and i32 |
| par-alloc | bench/par-alloc.ts | 1 | NL2100 x1 | bench/par-alloc.ts:18: Operator `<` requires two numeric operands, got i32 and f64 |
| par-histogram-atomic | bench/par-histogram-atomic.ts | 1 | NL2117 x1 | bench/par-histogram-atomic.ts:67: Argument 1 of `AtomicI32.exchange`: expected i32, got f64 |
| map-proto-ordered | bench/map-proto-ordered.ts | 27 | NL2100 x21, NL2021 x2, NL2231 x4 | bench/map-proto-ordered.ts:150: Operator `<` requires two numeric operands, got f64 and i32 |
| map-proto-ordered-fp | bench/map-proto-ordered-fp.ts | 27 | NL2100 x21, NL2117 x2, NL2231 x4 | bench/map-proto-ordered-fp.ts:156: Operator `<` requires two numeric operands, got f64 and i32 |
| map-proto-ordered-fp32 | bench/map-proto-ordered-fp32.ts | 27 | NL2100 x21, NL2117 x2, NL2231 x4 | bench/map-proto-ordered-fp32.ts:174: Operator `<` requires two numeric operands, got f64 and i32 |
| map-proto-unordered | bench/map-proto-unordered.ts | 21 | NL2100 x17, NL2231 x4 | bench/map-proto-unordered.ts:175: Operator `<` requires two numeric operands, got f64 and i32 |
| map-wordcount | bench/map-wordcount.ts | 10 | NL2100 x10 | bench/map-wordcount.ts:45: Operator `<` requires two numeric operands, got f64 and i32 |
| map-presize | bench/map-presize.ts | 5 | NL2100 x3, NL2117 x2 | bench/map-presize.ts:29: Operator `<` requires two numeric operands, got f64 and i32 |
| map-vs-stringmap | bench/map-vs-stringmap.ts | 27 | NL2236 x1, NL2100 x21, NL2117 x2, NL2178 x1, NL2231 x2 | bench/map-vs-stringmap.ts:90: Return type mismatch: function returns i32 but expression is f64 |

"IR lines changed" counts lines that differ over every module once SSA
numbers are masked, because one added instruction renumbers every `%N` after
it. Each kernel differs in 11 to 58 lines of its own module and 12 to 23 of
`std/threads`.

## What does not survive

20 of 34 programs are refused, for three reasons:

- **`main` returns a bare `number`** (NL2140; fib, sieve, strbuild, result:
  one error each). `const main = (): number =>` becomes `(): f64`, which is
  not an exit code. The diagnostic names the fix, `main(): i32`. It is the only
  error the checker reports for each, and these four are the suite's
  integer-heavy programs; whether they compile once `main` is annotated was
  not tried, because the spike measures the suite as it is.
- **A bare `number` meets an `i32`** (NL2100, NL2117, NL2178, NL2231, NL2236;
  the AWFY harness, the four map prototypes, the three `Map` measurements,
  par-alloc, par-histogram-atomic). A literal-initialised `let n = 0` or a
  `number` parameter is now f64, and Nish has no implicit conversion between
  f64 and i32, so every comparison, argument, return and store that mixes the
  two is an error: `i < n`, `AtomicI32.exchange(x)`, a `number[]` element
  stored into an `i32` field. The seven AWFY ports share one harness and one
  build, so they share its 23 errors.
- No program compiled and then printed something else: the output check
  (every program's checksum line, and both `seq` and `par` for a kernel)
  found no difference.

This is a finding about §5.3 in its own right: on a codebase that mixes
`number` and `i32`, `--number-mode f64` is not a flag that makes it slower,
it is a flag that stops it compiling.

## The three worst, and the IR behind them

By median ratio: par-heavy-fold (1.053x), par-single (1.030x) and
par-histogram (1.028x). All three differ from their default build in the same
way, and in no hot loop. To see it, mask the SSA numbers:

```sh
p=par-heavy-fold   # or par-single, par-histogram
diff <(sed -E 's/%[0-9]+/%N/g' build/bench/wp28-s5/$p/default/ir/$p.ll) \
     <(sed -E 's/%[0-9]+/%N/g' build/bench/wp28-s5/$p/f64/ir/$p.ll)
```

`.length` is a `number`, so under f64 it is a double. Everything that changes
is a conversion of a length at a loop's edge.

**par-heavy-fold** (37 lines of its module). `toI32(xs.length)` in a loop
condition was a truncation and is now a round trip through a double:

```llvm
; default
  %N = trunc i64 %N to i32
; f64
  %N = sitofp i64 %N to double
  %N = call i32 @llvm.fptosi.sat.i32.f64(double %N)
```

and `new Array<i32>(xs.length)` checks its length as a double before
converting it back:

```llvm
; default
  %N = trunc i64 %N to i32
  %N = sext i32 %N to i64
  %N = icmp ule i64 %N, 2147483647
; f64
  %N = sitofp i64 %N to double
  %N = fcmp oge double %N, 0.0
  %N = fcmp ole double %N, 9007199254740992.0
  %N = and i1 %N, %N
  ...
  %N = fptosi double %N to i64
```

The work itself, `work(xs[i], k)` and the fold `w + toU32(ys[i]) * toU32(i + 1)`,
is the same IR. The conversions are loop-invariant, which is why the
two binaries differ by 1237 instructions in 29.9 billion (+0.000004%).

**par-single** (34 lines). The same two shapes: `new Array<i32>(xs.length)`
and its `toI32(_.length)` loop bounds. 8 instructions of difference in 700
million.

**par-histogram** (11 lines). Only `main`'s argument test changes:
`process.argv.length > 1` compares as doubles, and the literal index in
`process.argv[1]` is a double converted back to an index:

```llvm
; default
  %N = trunc i64 %N to i32
  %N = icmp sgt i32 %N, 1
  %N = getelementptr inbounds i8*, i8** %N, i64 1
; f64
  %N = sitofp i64 %N to double
  %N = fcmp ogt double %N, 0x3FF0000000000000
  %N = fptosi double 0x3FF0000000000000 to i64
  %N = getelementptr inbounds i8*, i8** %N, i64 %N
```

Zero instructions of difference in 103 million: `opt` folds the constant
conversion away. At 33 ms a run, its 1.028x is start-up noise inside a ±8.4%
band.

The largest instruction difference is par-nbody's, +0.03% (296 thousand in
1.18 billion): it has the most such conversions (seventeen `toI32(_.length)` sites), several
of them bounds of the inner pair loop.

## The four that are already f64

nbody, spectral, vec3 and math carry `--number-mode f64` in their `.args`
sidecar, so the suite already builds them the way `--compat` would, and
adding the flag again changes nothing. After a run, each of these prints
nothing:

```console
$ diff -r build/bench/wp28-s5/nbody/default/ir build/bench/wp28-s5/nbody/f64/ir
$ diff -r build/bench/wp28-s5/spectral/default/ir build/bench/wp28-s5/spectral/f64/ir
$ diff -r build/bench/wp28-s5/vec3/default/ir build/bench/wp28-s5/vec3/f64/ir
$ diff -r build/bench/wp28-s5/math/default/ir build/bench/wp28-s5/math/f64/ir
```

Their price is 1 by construction, and they say nothing about what the mode
costs against i32: they have no i32 build to compare with.
