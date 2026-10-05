# WP31: Ranged integer types, designed for after G8

**Status: complete.** W1 to W4 shipped in 0.13.0: the type
([#261](https://github.com/amritk/nish/pull/261)), the proofs
([#268](https://github.com/amritk/nish/pull/268)), the host boundary
([#273](https://github.com/amritk/nish/pull/273)) and the measurements
([#274](https://github.com/amritk/nish/pull/274)). The finding (§10) is that
**a declared range is a frontend fact and not a speed-up**. The rules are
normative in [LANGUAGE.md](LANGUAGE.md#types) and the lowering is in
[IR_COOKBOOK.md](IR_COOKBOOK.md); this note keeps the decisions and why.

`integer<Lo, Hi>` is the declared form of
[wp15-performance.md](wp15-performance.md#2-zero-cost-safety-the-bounds-check-pipeline)
§2 mechanism 1. wp15 item 6 shipped the analysis and not the syntax because the
syntax needed type parameters; WP18 supplied those, but every WP18 type
argument is a type, and a bound is a number (§4).

## 1. The decision

| # | Question | Decision | Rejected |
| --- | --- | --- | --- |
| 1 | Spelling | `integer<Lo, Hi>`, both bounds integer literals, declared for `tsc` as `type integer<Lo extends number, Hi extends number> = number` (§3). | A branded type, a `Ranged<…>` class, or a name per range. |
| 2 | The literal argument | A type node, `N_TYPE_LITERAL`, parsed wherever a type is and refused everywhere but as a bound of `integer`. An interned kind, `K_RANGED`, mangled `rng.p0.p255` (§4). | Literal type arguments in general, which are const generics. |
| 3 | Representation | Always `i32`, in both number modes. Bounds must lie in `i32`. No relation to `u8`/`u16`/`u32` beyond an explicit conversion (§5). | The smallest width that fits, or `u32` above `INT_MAX`. |
| 4 | Entering the range | A checked entry: an unproven value is compared once and the program panics outside the range; no check where the literal, the source type or the flow facts prove it; an out-of-range literal is a compile error (§6). | A compile error for every unproven value; a conversion builtin. |
| 5 | Leaving the range | Every operator reads a ranged value as `i32`. The range survives copies, `const`, reads, returns and type arguments. Nothing computes a range (§7). | Interval arithmetic in the types. |
| 6 | Feeding `src/bounds.ts` | The type answers `nonNegative` and `maxIndex` directly, with no invalidation rule (§8). | Recording the range as facts that assignments forget. |
| 7 | Interop and `-g` | `int32_t` in C, `number` in `.d.ts`, the range in the comment above both, a `RangeError` at the N-API and wasm bridges, G8's `nish_gen_` names, a DWARF typedef (§9). | `DW_TAG_subrange_type`, which LLVM 18 cannot write. |

## 2. What it can and cannot prove

A bounds proof needs `0 <= i` and `i < holder.length`. A range gives the first,
and gives `i < Hi + 1`, which becomes `i < holder.length` only where the
holder's *minimum length is known*: a 256-entry table, `new Array<u8>(256)`, or
a parameter behind a length guard. It can never prove `i < s.length` for a
length known only at run time, because no literal can state that length; the
flow facts do that job. The unsigned widths were already one declared range —
`knownNonNegative` read their lower bound off the declaration — and
`integer<Lo, Hi>` generalises that line to both ends.

The motivating program is wp15's `getByte` (§12). Before WP31 its index check
survived in the callee and cost it and its callers `willreturn` and `readonly`,
while `opt -O3` removed the check after inlining. So the gain was always going
to be in what the frontend knows, not in loop time on a program LLVM inlines
whole, and §10 held the acceptance to that.

## 3. Spelling, and the declaration `tsc` reads

`runtime/nish.d.ts` declares `type integer<Lo extends number, Hi extends number>
= number`, an alias as it does for `i32` and `u8`, because a brand would break
`let x: i32 = 5`. `tsc --strict` accepts every construct the note uses and
refuses a non-number bound (TS2344). No TypeScript lib declares `integer`. The
name was reserved in 0.10.0 by its own breaking change
([#201](https://github.com/amritk/nish/pull/201); NL2332 for a class,
interface or function of that name, NL2333 for `integer` as a type), so W1
broke nothing.

## 4. The literal type argument

`parsePrimaryType` accepts a number, or `-` and a number, as `N_TYPE_LITERAL`,
wherever a type is parsed — "lex and parse what is written; refuse in the phase
that owns the rule" — so `const x: 5 = 5` parses and the checker refuses it by
name. No speculative parse is needed, since a number could not start a type
before. The checker resolves `integer` beside `Result` and `Array` to
`rangedOf(lo, hi)` and refuses a missing or extra bound, a non-literal bound
(a constant is not one; §11), a float, an empty range, a bound outside `i32`,
and a literal type anywhere else. `integer<0, 0xFF>` is `integer<0, 255>`.

`K_RANGED` is interned by `(lo, hi)` over `T_I32`, so type equality stays an
integer compare. `mangle` writes each bound as `p` or `m` and its decimal value:
`rng.p0.p255`, `rng.m128.p127`. The sign letter keeps the mangling
prefix-coded, which is what keeps `cStructName`'s escape injective ("a digit can
never follow one of the mangling's separators"); `rng.0.255` would break that.

**Rejected: literal type arguments in general** (`FixedBuffer<256>`). A
numeric argument to a user template is a const generic, which needs value
parameters, substitution into expressions and an extended termination rule.
`integer` is a builtin whose two bounds are its whole content, so refusing a
literal everywhere else keeps const generics a construct of their own.

## 5. Representation

**A ranged value is an `i32`, always** — in IR, in memory, at the ABI, and under
`--number-mode f64`, where an `f64` must go through `toI32(x)` (which
saturates) and then enters with a check. A ranged index is an `i32` index in
f64 mode too, so it keeps the proof an `f64` index never gets.

`u8`, `u16` and `u32` are unrelated types that happen to have ranges:
`integer<0, 255>` has `i32`'s arithmetic, which is checked for signed
overflow, while a `u8`'s wraps. Mixing them is the existing mixed-width error,
and the conversion is `toI32(b)`, which W2 proves free.

**Rejected: the smallest width that fits**, because one bound would then decide
whether `x + 1` wraps, and every struct holding one would change layout.
**Rejected: a `u32` base above `INT_MAX`**, because moving `Hi` by one would
flip the arithmetic from signed to unsigned, and `maxIndex` carries nothing past
`I32_MAX` anyway.

## 6. Entering the range

Every position where another type becomes a ranged value is an *entry*: an
annotated initialiser, an assignment (compound forms, `++` and `--` included),
an argument, a `return`, a field initialiser or object-literal field, an
array-literal element, an element store, or `push`. The source must be an `i32`
or a ranged type. An entry compiles to **nothing** when a literal, a subrange or
the flow facts prove it (§8); to **a compile error** for a literal outside the
range (``Literal `12` is outside integer<0, 9>``); and otherwise to **one
unsigned compare and a cold panic** — `sub` by `Lo`, `icmp ult` against
`Hi - Lo + 1`, the shape of the index check — sharing `panic`'s tail, with no
runtime symbol added.

**Why a checked entry.** The flow facts are imprecise on purpose, and the index
check's rule already fits that: *the proof changes what the program costs, never
what it means*. A compile error for an unproven value would make whether a
program compiles depend on an analysis's precision, and a conversion builtin
cannot be spelled, since its target is a type and a call site takes no type
arguments.

The range check is the type's semantics, so `--unchecked-indexing` (deprecated
since #422) does not remove it.

**Under Node the check does not exist.** `integer` erases to `number`, so a
program that fails an entry exits 1 natively and runs on under Node — the same
class of divergence as an unchecked `a[i]`. It is declared in
[RUN_UNDER_NODE.md](RUN_UNDER_NODE.md#what-stays-divergent), in
`tests/differential/unmodified.js`'s `KNOWN` list (`rng_entry_panic_f64`), and
in `tests/differential/known-failures.txt`. A program that fails an entry is
therefore a `tests/cases/` panic case, never a `tests/differential/corpus/`
program, whose job is to agree with Node.

## 7. Leaving the range

Every operator reads a ranged value as `i32`, so mixing one with an `i32` is
never a type error, and writing a result back into a ranged place is an entry.
The range survives where nothing is computed: a copy and a `const` (`const j = r`
keeps `r`'s type, an unannotated `let` widens, as in TypeScript's literal
widening), a read of a ranged field, element or result, and a type argument
(`identity(r)` infers `integer<0, 255>`, at the cost of one more `define` per
distinct range; §11).

**The loop-counter trap.** `for (let i: integer<0, 255> = 0; i < 256; i++)`
panics on the last `i++`, because the counter must reach 256 to leave the loop.
Put the range on the value used, not on the counter —
`for (let i = 0; i < 256; i++) { const b: integer<0, 255> = i; }` — which the
loop condition proves (`perf_rng_quiet`, and `perf_rng_counter` for the trap).
A cursor advanced by `i = i + 1` is the same shape, which §10 made a named
criterion.

**Rejected: interval arithmetic in the types**: an expression's type would
depend on its values, instantiations would multiply with every operator, and
overflow would have to be modelled in the type system.

## 8. One more fact source for `src/bounds.ts`

**The type answers; the state does not store.** `declaredRange(type)` in
`src/types.ts` answers `[Lo, Hi]` for a ranged type and the natural ranges of
`u8`, `u16`, `u32` and `u64`. `knownNonNegative` answers true for `Lo >= 0`, and
`maxIndexOf` also considers `Hi + 1`. No invalidation is needed: every write to
a ranged local is an entry, so the value is in range at every program point
whatever `forget` retracts. Facts stay keyed by variable, so a ranged *field*
proves nothing until it is read into a local.

An entry of an `i32` local into `[Lo, Hi]` is proven when the lower end holds
(`Lo` is `I32_MIN`, or `Lo <= 0` and the value is known non-negative) and the
upper end holds (`Hi` is `I32_MAX`, or the value's `maxIndex` is at most
`Hi + 1`); the verdict goes to `program.nodeProvenRange`, which the emitter
reads as it reads `nodeProvenIndex`. `Lo > 0` is never proven from flow, since
`orderFacts` records no lower bound but zero. The unsigned widths gained their
upper half for free, and `const k = toI32(x)` of an unsigned `x` gets
`maxIndex(k, Hi + 1)`. **A check that survives inside a loop warns** in the
`performance` class beside `NL9007`, naming the guard that would prove it.

## 9. Interop and `-g`

Every spelling is one G8 already chose ([wp18-generics.md](wp18-generics.md#157-g8-the-peripheries-and-what-it-decided)).

| Surface | `getByte(buf: u8[], i: integer<0, 255>): u8` | `Box<integer<0, 255>>` |
| --- | --- | --- |
| LLVM | `i32 %i` | `%struct.Box$rng.p0.p255` |
| C header | `int32_t i`, the range in the comment above the prototype | `struct nish_gen_Box_rng_p0_p255` |
| `.d.ts`, wasm loader | `i: number`, the range in the comment | `nish_gen_Box_rng_p0_p255` |
| N-API | read as a double; outside `[0, 255]` or not an integer, `napi_throw_range_error` naming the function, parameter and range | as `.d.ts` |
| DWARF | `DW_TAG_typedef` named `integer<0, 255>` over `int` | `name: "Box<integer<0, 255>>"` |

**Where the check lives at an ABI boundary is the linkage condition**
(`privateAbi`, renamed from `privateResultAbi`): where every caller is visible,
ranged parameters are checked at each call site, where the facts are;
otherwise the callee checks them in its prologue and its callers skip theirs.
The bridges check again, so a JavaScript host sees a `RangeError`, not a process
exit. The value is read as a double because `ToInt32` would wrap 4294967301 to
5, which is in range.

A range in a non-scalar exported position (`integer<0, 255>[]`, a ranged field)
is data the host writes and nothing checks, so such a function gets the
existing "no C spelling" skip. A `declare function` may not mention a ranged
type at all: the range would be a promise C never made
([wp27-ffi.md](wp27-ffi.md)). DWARF uses a typedef because LLVM 18's
`llvm-as` rejects `!DISubrangeType` ("expected metadata type"); when the
toolchain floor moves past it, the typedef can become a subrange type without
any change to what a user writes.

## 10. Stages, the rolling freeze, and the acceptance program

| Stage | Delivered | Tests |
| --- | --- | --- |
| **W1**, #261 | the type, the §4 refusals, every entry checked, §7's widening, the `declare function` refusal, the `-g` typedef, the `nish.d.ts` line, and the Node divergence of §6 | `rng_param`, `rng_generic`, `rng_widen`, `rng_entry_panic`, `rng_entry_panic_f64`, `dbg_rng`, `reject_rng_*` |
| **W2**, #268 | §8: the two queries, `nodeProvenRange`, the unsigned upper bounds, the `toI32` fact, the `performance` warning | `perf_rng_loop`, `perf_rng_quiet`, `perf_rng_counter`, `arr_bounds_ranged` |
| **W3**, #273 | §9: the prologue check, the N-API and wasm `RangeError`, the header and `.d.ts` comments | `interop_rng_*` |
| **W4**, #274 | the acceptance program, committed as `bench/cursor.ts` and `bench/getbyte.ts` | the IR criteria in `tests/run.js`'s bench section |

**The rolling freeze.** `src/` could write `integer<…>` only from the release
after W1. The prediction for adopting it there is modest: none of the
seventeen checks wp15 §2.4 counts surviving in `src/`'s loops is an index into
a table of known size, which is the only thing a range proves.

### What W4 measured

Protocol: x86-64, four-core Xeon VM, clang 18.1.3, `nish 0.12.0` at `60df17a`,
`--profile speed` against the same command with `--unchecked-indexing`; user
plus system CPU from `getrusage`, 3 warm-ups and 15 timed runs per binary,
alternating, pinned with `taskset -c 2`; ratios divide minimums.

**Step 1: the cursor** (`bench/cursor.ts`, item 3's lexer-shaped scan over
`cat src/*.ts`, 2,028,734 bytes, 400 passes):

| build | CPU min | CPU median | / unchecked |
| --- | ---: | ---: | ---: |
| `--unchecked-indexing` | 2555.9 ms | 2619.5 ms | 1.000 |
| **proven** (the default) | **2531.8 ms** | 2608.3 ms | **0.991** |
| the cursor declared `integer<0, 2147483647>` | 2653.2 ms | 2780.9 ms | 1.038 |

The proven and unchecked executables are **byte-identical**, so the ratio
between them is noise. wp15's 1.069x cannot be re-derived as a ratio, since it
divided a build from before the proof existed; what is re-derived is that the
proven cursor *is* the unchecked one.

**Step 2: declaring the cursor is the mistake the warning exists for.** Its
bound is `s.length`, which no range states, so the declared twin warns at each
of its three advances and costs **1.038x** (1.062x at the median) and 280
bytes of executable.

**Step 3: `getByte`, judged by its IR.** With `i: integer<0, 255>`, `@getByte`
has no `nish_panic_index`, and it, `@sumCalled` and `@sumInline` all reach
`{ nounwind willreturn readonly }`; the range entry in `@sumCalled` compiles to
nothing. Timed (65,536 rounds, checksum 1,095,227,845,120), the ranged build is
**0.994x** the unchecked one — the same executable, so **1.00x**: the declared
range is a frontend fact, not a speed-up, as wp15 §2b said of counted loops.

The second finding: #222, which landed after §2's measurement, hands an
internal function the facts all its call sites prove, so the `i32` spelling of
the closed program now compiles to the same module. The range matters where the
compiler cannot see the callers: exported, the `i32` spelling keeps its check
in the body, and the ranged one moves it to §9's prologue — to where the caller
can see it, not away.

## 11. Open

- **A lower-bound family**: a fact `i >= n` for `n > 0`. No program has needed
  it.
- **Merging instantiations that differ only by range**: a code-size question
  for a real program.
- **A constant as a bound** (`integer<0, MAX>`): TypeScript cannot write it
  without `typeof`, which Phase 0 forbids.
- **A length floor in a type** (`FixedBuffer<256>`): a const generic, which §4
  declines; a length guard is the spelling until it is designed.
- **`x & 255` and `Math.min(x, 255)` as fact sources**: sound, and the kind of
  peephole wp15 §2 refused inside the proof, each to come only when a
  measurement asks.

## 12. Appendix: the programs this note ran

§2's `getbyte.ts`, the pre-WP31 spelling. `bench/getbyte.ts` and
`tests/cases/perf_rng_getbyte` hold the same three functions with
`i: integer<0, 255>`.

```ts
// Today's spelling of wp15 §2's getByte: an i32 index and a length guard.
const getByte = (buf: u8[], i: i32): u8 => {
  if (buf.length < 256) {
    return 0;
  }
  return buf[i];
};

// The same access with the loop in the same function.
const sumInline = (buf: u8[]): i32 => {
  if (buf.length < 256) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum = sum + toI32(buf[i]);
  }
  return sum;
};

// The loop in the caller, the access in the callee.
const sumCalled = (buf: u8[]): i32 => {
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum = sum + toI32(getByte(buf, i));
  }
  return sum;
};

export const main = (): number => {
  const table: u8[] = new Array<u8>(256);
  return sumInline(table) + sumCalled(table);
};
```
