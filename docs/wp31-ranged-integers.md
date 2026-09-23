# WP31: Ranged integer types, designed for after G8

**Design note (proposed, nothing built).** This decides the surface and the
semantics of `integer<Lo, Hi>`, the declared form of
[wp15-performance.md](wp15-performance.md#2-zero-cost-safety-the-bounds-check-pipeline)
§2 mechanism 1, so that building it after WP18 G8 is a build and not a
decision. [LANGUAGE.md](LANGUAGE.md) stays normative and this note adds no rule
to it; where they disagree, LANGUAGE.md wins.

wp15 §9 item 6 shipped the analysis and not the syntax, because `integer<0, 255>`
"needs the generics of item 8". Those generics have landed
([wp18-generics.md](wp18-generics.md#15-what-landed) §15), and so have G8's
code stages (#163 to #168). Only its docs stage, which closes WP18 in
`docs/LANGUAGE.md`, remains. The type argument this note needs is
not one WP18 has, though: every WP18 type argument is a type, and a bound is a
number. §4 is that difference.

---

## 1. The decision

| # | Question | Decision | Rejected |
| --- | --- | --- | --- |
| 1 | Spelling | `integer<Lo, Hi>`, both bounds numeric literals, declared for `tsc` as `type integer<Lo extends number, Hi extends number> = number` (§3, proved under `--strict`). | A branded type, a `Ranged<…>` class, or a new name per range. |
| 2 | The literal argument | A new type node, `N_TYPE_LITERAL`, parsed wherever a type is parsed and refused by the checker everywhere except as a bound of `integer`. A ranged type is a new interned kind, `K_RANGED`, mangled `rng.p0.p255` (§4). | Literal type arguments in general, which would be const generics. |
| 3 | Representation | Always `i32`, in both number modes, whatever the bounds. Bounds must lie in `i32`. No relation to `u8`/`u16`/`u32` beyond an explicit conversion (§5). | The smallest width that fits, or `u32` above `INT_MAX`. |
| 4 | Entering the range | A checked entry: an unproven value is compared once and the program panics outside the range. The check is not emitted where the literal, the source type or the §2 facts prove it. An out-of-range literal is a compile error (§6). | A compile error for every unproven value, and an explicit conversion builtin. |
| 5 | Leaving the range | Every operator reads a ranged value as `i32`, so arithmetic is `i32`. The range survives copies, `const` inference, reads of ranged fields and elements, returns, and type arguments. Nothing computes a range (§7). | Interval arithmetic in the types. |
| 6 | Feeding `self/bounds.ts` | A ranged local's type answers `nonNegative` and `maxIndex` directly, the way `isUnsigned` answers `nonNegative` today, and needs no invalidation rule. The same facts decide which entry checks are elided (§8). | Recording the range as ordinary facts, which assignments would then forget. |
| 7 | Interop and `-g` | `int32_t` in C, `number` in `.d.ts`, the range in the comment above both, and a `RangeError` at the N-API and wasm bridges. A ranged type argument goes through G8's `nish_gen_` names. DWARF gets a `DW_TAG_typedef` named with the display spelling (§9). | `DW_TAG_subrange_type`, which LLVM 18 cannot write, and a new naming scheme. |
| 8 | Stages | W1 adds the type and always checks entry. W2 adds the proofs, W3 the bridges, and W4 the acceptance measurement. `self/` may write it from the release after W1. The item 3 cursor must not regress, and `getByte` is judged by the IR the frontend writes (§10). | One change, and a promise of speed that has not been measured. |

---

## 2. What exists today, and what the declared form would add

**The spelling does not parse.** In the compiler built from `main` at
`08b83df` (`npm run build`, `nish 0.8.0`), this line:

```ts
export const getByte = (buf: u8[], i: integer<0, 255>): u8 => buf[i];
```

fails with ``1:47: syntax error: expected a type name, found `NUMBER` ``
at the `0`, followed by 17 cascading syntax errors. `parsePrimaryType` in
`self/parser.ts` accepts only `(`, `null` and an identifier. `Box<3>` fails
the same way.

**The language already has one declared range**, and `self/bounds.ts` reads
it. `knownNonNegative` answers `true` for any `u8`/`u16`/`u32`/`u64` before it
looks at a single fact, because an unsigned type "cannot hold a negative value,
so their lower bound is read off the declaration". A declared `integer<Lo, Hi>`
generalises that one line to both ends (§8).

**What a range can prove, and what it cannot.** `proves` in `self/bounds.ts`
needs `0 <= i` and `i < holder.length`. A range gives the first half, and it
gives `i < Hi + 1`, which becomes `i < holder.length` only through
`knownMinLength(holder, Hi + 1)`. A range therefore proves an index into a
container whose *minimum length is known*: a 256-entry table, a buffer
allocated as `new Array<u8>(256)`, or a parameter checked with a length guard.
It can never prove `i < s.length` for a length that is only known at run time,
because no literal can state that length. The flow facts already do that job.

**The measured shape of the gap.** `getByte` written today, with an `i32`
index and a length guard, next to the same loop with the access inlined by
hand (the program is §12's `getbyte.ts`):

```bash
build/nish getbyte.ts -o getbyte.ll
```

| Function | `nish_panic_index` calls | Attribute group |
| --- | ---: | --- |
| `@getByte(buf, i: i32)`, guard `buf.length < 256` | 1 | `{ nounwind }` |
| `@sumInline`, the loop and the access in one function | 0 | `{ nounwind willreturn readonly }` |
| `@sumCalled`, the loop calling `getByte` | 0 | `{ nounwind }` |

The check in `@getByte` survives because `i` is a parameter with no facts.
Nothing warns about it, because the access is not inside a loop in its own
function. The panic call is also what costs `@getByte`, and every caller of it,
`willreturn` and `readonly`. After `opt -O3 getbyte.ll -S` the whole program
has been inlined into `@nish_main` and **no `nish_panic_index` call is left**:
LLVM recovers the proof once the callee is inlined into the loop. So the
getByte gain is in what the frontend knows (attributes, the warning, where the
check sits), not in loop time on a program LLVM inlines whole, and §10 holds
the acceptance to that.

---

## 3. Spelling, and the declaration `tsc` reads

**Decision: `integer<Lo, Hi>`, and one line in `runtime/nish.d.ts`:**

```ts
// ---- Ranged integers (docs/wp31-ranged-integers.md) --------------------------
//
// An `i32` the compiler knows lies in `[Lo, Hi]`. The bounds are numeric
// literal types, and `tsc` checks only that; the range itself is `nish`'s.
type integer<Lo extends number, Hi extends number> = number;
```

It is an alias of `number`, the same thing the file does for `i32` and `u8`,
for the reason that file gives: a brand would break `let x: i32 = 5`. So
`integer<"a", 3>` is refused by `tsc` before `nish` sees it.

**The name is free.** No declaration in `node_modules/typescript/lib/*.d.ts`
(TypeScript 5.9.3) matches `(type|interface|declare var|declare const|class)
integer`, so the global cannot collide with a lib type at any `lib` setting.
It is not a builtin name in the compiler either: `scalarNamed` and
`builtinTypeName` in `self/annotations.ts` do not know it. Today
`type integer = i32;` and `class integer { … }` both compile (checked with
`build/nish`). W1 adds `integer` to `builtinTypeName`, which refuses an alias
and an enum of that name the way `type Result = …` is refused. It also refuses
a class, interface or function called `integer`, because otherwise
`integer<0, 255>` would mean two things in a module that declared one. That
breaks any program that declares something called `integer`, so W1 is
`feat(checker)!` with a `BREAKING CHANGE:` trailer.

**Rejected: a new name for each range, like `index256` or `byte`.** A fixed
list covers the ranges somebody thought of and no others. **Rejected: a
branded type** (`number & { __range: [Lo, Hi] }`), which makes every literal
assignment a `tsc` error. **Rejected: a generic class `Ranged<Lo, Hi>`**,
because a class is a pointer to a struct and a range must cost nothing to
represent.

### 3a. The proof

The declaration above was appended to a copy of `runtime/nish.d.ts` in a
scratch directory, not in the tree, beside §12's `examples.ts` and
`refused.ts`:

```bash
$ npx tsc --strict --noEmit --target ES2022 --lib ES2022 --moduleDetection force nish.d.ts examples.ts
exit 0
$ npx tsc --strict --noEmit --target ES2022 --lib ES2022 --moduleDetection force nish.d.ts refused.ts
refused.ts(2,38): error TS2344: Type 'string' does not satisfy the constraint 'number'.
exit 2
```

`examples.ts` uses every construct in this note: a ranged parameter, a
negative bound, a ranged `const` inside a loop, a ranged value widening into
an `i32`, and arithmetic on it. It also has the four things `tsc` accepts and
`nish` will refuse (§4). Adding `--noUnusedParameters --noUnusedLocals`
still exits 0, because an unused type parameter of a type alias is not
reported. The same copy of the declaration file, put in place of
`runtime/nish.d.ts` in the repository's own `tsconfig.json` (an `extends` of it
over `self/`, `std/` and `tests/nish/`), also exits 0. The line can therefore
land in W1 without disturbing `npm run check`.

---

## 4. The literal type argument

WP18's type arguments are all types ([wp18-generics.md](wp18-generics.md#2-the-surface-what-is-written)
§2). A bound is a value. The decision is to make it a value in exactly one
place.

**`self/parser.ts`.** `parsePrimaryType` gains one shape: a `TOK_NUMBER`, or a
`-` followed by one, becomes `N_TYPE_LITERAL`. That is the next node kind,
`61`, and `N_COUNT` moves to `62`, because kinds are appended and never moved.
Its `text` is the literal as written (`-5`, `0xFF`). It is parsed wherever a
type is parsed, following `.claude/selfhost.md`'s rule to "lex and parse what
is written; refuse in the phase that owns the rule", so `const x: 5 = 5` parses
and is refused by the checker with a message that names the rule. The
`typescript` parser reads the same text as a `LiteralType` whose child is a
`NumericLiteral` or, for `-5`, a `PrefixUnaryExpression`.
`tests/parser_oracle.js` maps both to the new kind, span for span. No
speculative parse is needed, because a number cannot start a type today. The
one-token parser that forbids type arguments at a call site
([wp18-generics.md](wp18-generics.md#2a-inference-and-why-there-are-no-type-arguments-at-a-call-site)
§2a) is untouched, and so is `expectTypeArgumentEnd`.

**The checker.** `resolveReference` in `self/annotations.ts` answers
`integer` beside `Result` and `Array`, before any declared name and before
`structTemplate`. It resolves to `ctx.table.rangedOf(lo, hi)`. Each refusal
below gets a code in the NL2xxx band, allocated when W1 is built:

| Written | Answer |
| --- | --- |
| `integer`, `integer<0>`, `integer<0, 1, 2>` | refused: `integer` needs two bounds, `integer<0, 255>` |
| `integer<n, 9>`, `integer<i32, 9>` | refused: a bound must be an integer literal, and a constant is not one (the note says why in §11) |
| `integer<0, 1.5>` | refused as a non-integer literal, in the words of `reject_i64_literal_float` |
| `integer<10, 0>` | refused: the range is empty |
| `integer<0, 4294967295>`, `integer<-2147483649, 0>` | refused: the bound does not fit in `i32` (§5) |
| a literal type anywhere else: `const x: 5`, `Box<3>`, `(3)[]` | refused: a literal type is only a bound of `integer` |
| `integer<0, 0xFF>` | accepted, and the same type as `integer<0, 255>` |

**The type table.** `K_RANGED` is interned by `(lo, hi)` with a base of
`T_I32`, so `sameType` stays an integer compare. `llvmType`, `sizeOf` and
`alignOf` answer `i32`'s. `typeName` answers `integer<0, 255>` in canonical
decimal whatever was written. This is the display spelling, and G8 (#164)
already threads it through instantiation names.

**`mangle`.** `integer<0, 255>` is `rng.p0.p255` and `integer<-128, 127>` is
`rng.m128.p127`. Each bound is `p` (plus) or `m` (minus) followed by its
canonical decimal value. The encoding is prefix-coded like the rest of
`TypeTable.mangle`: `rng.` is a tag no other constructor starts with, a class
called `rng` mangles as `$rng`, and a run of digits ends at the first
non-digit. `cStructName`'s
escape in `self/interop_abi.ts` is injective because "a digit can never follow
one of the mangling's separators", so a `_0` in a C name is always the `_` the
user wrote. `rng.0.255` would break that argument, and `rng.p0.p255` keeps it.
So `Box<integer<0, 255>>` is `%struct.Box$rng.p0.p255`,
`identity<integer<-128, 127>>` is `@identity$rng.m128.p127`, and G8's names
follow with no new rule (§9).

**Rejected: literal type arguments in general** (`FixedBuffer<256>`,
`Box<3>`). A numeric argument to a user template is a const generic. It needs
a value parameter in the template, substitution into expressions, and the
termination rule of wp18 §4 extended to values.
[wp23-language-surface.md](wp23-language-surface.md) deferred compile-time
parameters to WP18 for that reason, and nothing in this note needs them.
`integer` is a builtin and its two bounds are its whole content.

---

## 5. Representation

**Decision: a ranged value is an `i32`, always.** It is `i32` in IR, in
memory and at the ABI. It is `i32` under `--number-mode f64` too, where an
`i32` is still an `i32` and only `number` changes. Both bounds must fit in
`[-2147483648, 2147483647]`.

- **Under `--number-mode f64`**, `number` is `f64` and does not enter a range
  implicitly. There is no implicit conversion anywhere in this language
  ([LANGUAGE.md](LANGUAGE.md#types)), so an `f64` argument to a ranged
  parameter is a type error, and the program writes `toI32(x)`. That
  saturates, and then the value enters the range with a check (§6). A literal
  takes the ranged type from context in both modes, as it takes `u8` today
  ([Numeric literals](LANGUAGE.md#numeric-literals)). A ranged index is an
  `i32` index in f64 mode too, so it keeps the proof that an `f64` index never
  gets ("a bound on the double is not a bound on its truncation").
- **`u8`, `u16` and `u32` are unrelated types** that happen to have ranges.
  `integer<0, 255>` is not `u8`: its arithmetic is `i32`'s (`add nsw`, signed
  compare) and a `u8`'s wraps. Mixing them is the error mixing `u8` and `i32`
  already is ([Unsigned integers](LANGUAGE.md#unsigned-integers)), and the
  conversion is `toI32(b)`, which W2 proves free (§8).

**Rejected: the smallest width that fits** (`integer<0, 255>` as `i8`).
Changing the width changes the arithmetic, so one bound would decide whether
`x + 1` wraps. It would also move every struct layout that holds one, which is
a two-sided change for every class in the header. The narrow widths already
exist for anyone who wants the bytes. **Rejected: a `u32` base when
`Hi > 2147483647`.** Moving `Hi` by one would flip the arithmetic from
signed `nsw` to unsigned wrapping. An index cannot use the upper half anyway,
because `maxIndex` is an `i32` fact and `self/bounds.ts` carries nothing past
`I32_MAX`. Values above `INT_MAX` are what `u32` is for.

---

## 6. Entering the range

**Decision: a checked entry.** Every position where a value of another type
becomes a ranged value is an *entry*:

- an annotated initialiser;
- an assignment: `=`, the compound forms, `++` and `--`;
- an argument, whether to a function, a method or a constructor;
- a `return`;
- a field initialiser or an object-literal field;
- an array-literal element, an element store, or `push`.

The source must be an `i32` or another ranged type. Anything else is the
ordinary type error. The entry then compiles to one of three things:

1. **Nothing**, when the source is a literal inside `[Lo, Hi]`, or a ranged
   type inside `[Lo, Hi]` (a subrange is free), or a value the §2 facts
   already place in the range (§8).
2. **A compile error**, when the source is a literal outside the range:
   ``Literal `12` is outside integer<0, 9>``, in the voice of
   ``Literal `256` does not fit in u8`` (`reject_u_literal_too_wide`).
3. **One unsigned compare and a cold panic**, otherwise:
   a plain `sub i32 %v, Lo` then `icmp ult` against `Hi - Lo + 1`, which is the
   shape of the index check. With `Lo = 0` it is exactly `icmp ult %v, Hi + 1`,
   and a range that is all of `i32` needs no check at all. The blocks are
   `rng.ok` and `rng.fail`. The failure path is `panic`'s: W1 factors the
   `nish_write` + `nish_exit` + `unreachable` tail that `emitPanic`
   (`self/emit_builtins.ts`) and `emitExpect` (`self/emit_result.ts`) each
   spell out into one helper, and `self/attributes.ts` records the same two
   callees for it that it records for `expect`. No runtime symbol is added,
   so `runtime.c`'s budget, 3,515 of 3,584 bytes per
   `.claude/architecture.md`, does not move.

**Why a checked entry.** The §2 facts are imprecise on purpose (wp15 §2
declines the `min` shape as a peephole, and `orderFacts` records no lower bound
but zero). The index check's rule already fits that: *the proof changes what
the program costs, never what it means*
([Element access](LANGUAGE.md#element-access)). A range entry under the same
rule is sound however weak the analysis is, gets cheaper as it improves, and
can be reported by `NL9007`'s warning class naming the guard that would remove
it (§8).

**Rejected: a compile error for an unproven value.** That makes whether a
program compiles depend on the precision of an analysis that is kept
imprecise on purpose. A release that retires a fact would turn working
programs into errors, and every program `tsc` accepts would need a
hand-written guard at every entry.

**Rejected: an explicit conversion builtin.** It cannot be spelled. Its
target is a type, and a type argument at a call site is a compile error
([wp18-generics.md](wp18-generics.md#2a-inference-and-why-there-are-no-type-arguments-at-a-call-site)
§2a). Taking the target from context the way `Ok(...)` does is a second
mechanism that §2a deferred on purpose. Nor would it add anything: the checked
entry *is* the conversion, written where the program already says which range
it wants.

**The check survives `--unchecked-indexing`**, which removes index checks
only. Like the `substring` clamp (header of `self/bounds.ts`), the range check
is the type's semantics, and the clamp fold reads the facts a range feeds, so
an unchecked entry could fold away a clamp that JavaScript requires.

**`--wrapping`** changes nothing about an entry. It only decides whether the
`i32` arithmetic *before* the entry wraps.

---

## 7. Leaving the range

**Decision: every operator reads a ranged value as its base, `i32`.** So
`r + 1` is an `i32`, `r < 9` compares two `i32`s, `a[r]` is an `i32` index,
`` `${r}` `` prints an `i32`, and `toI64(r)` is `sext`. Mixing a ranged value
with an `i32` is therefore never a type error. Assigning the result back into
a ranged place is an entry (§6).

A range survives where no computation happens:

- **a copy and a `const`**: `const j = r` has `r`'s type. A `let` without an
  annotation widens to `i32`, because it will be reassigned. This follows
  TypeScript's own literal widening, where `const x = 5` is `5` and
  `let x = 5` is `number`;
- **a read** of a ranged field, element, or function result;
- **a type argument**: `identity(r)` infers `T := integer<0, 255>` exactly, as
  wp18 §2 says of every type argument ("every existing type rule applies to a
  type argument unchanged"), and `Box<integer<0, 255>>` holds its range. The
  cost is one more define for each distinct range, identical apart from the
  name. §11 leaves open whether that is worth merging.

**The loop-counter trap.** A range on the counter itself is wrong:

```ts
for (let i: integer<0, 255> = 0; i < 256; i++) { ... }   // panics on the last i++
```

The counter has to reach 256 to leave the loop, and 256 is outside the range,
so the last `i++` fails its entry check. Ada has a `for` over a range
precisely to avoid this. Nish does not, so the rule is to put the range on
the value that is used, not on the counter:

```ts
for (let i = 0; i < 256; i++) {
  const b: integer<0, 255> = i;   // proven by i >= 0 and i < 256: no check
}
```

The same reasoning applies to a cursor advanced by `i = i + 1`: every advance
is an entry. §10 makes that a named acceptance criterion, because the item 3
cursor is exactly that shape.

**Rejected: interval arithmetic in the types**
(`integer<0, 255> + integer<0, 255>` as `integer<0, 510>`). The type of an
expression would depend on its values, and ranges would multiply
instantiations with every operator. Overflow would have to be modelled in the
type system, and that is `--wrapping`'s question moved somewhere it cannot be
answered per build. The facts can already learn `i + 1 <= n` where they need
to, without types.

---

## 8. One more fact source for `self/bounds.ts`

**Decision: the type answers, the state does not store.** One query in
`self/types.ts`, `declaredRange(type)`, answers `[Lo, Hi]` for a ranged type,
`[0, 255]` and `[0, 65535]` for `u8` and `u16`, `[0, …]` for `u32` and `u64`,
and nothing otherwise. Two queries in `self/bounds.ts` ask it, and neither
gains a fact that can be forgotten:

- `knownNonNegative(state, v)` answers `true` when the declared `Lo >= 0`,
  which replaces the `isUnsigned(v.type)` line it has today;
- `maxIndexOf(state, i)` also considers the declared `Hi + 1` when
  `Hi < I32_MAX`, and returns the smaller of that and the recorded facts.

No invalidation is needed, for the reason the unsigned lower bound needs
none. Every write to a ranged local is an entry, so the value is inside
`[Lo, Hi]` at every program point, whatever `forget` and
`forgetUpperBounds` retract. That covers `--wrapping` too, because
`keepsLowerBound` is about increments and an increment of a ranged local is
checked. Facts stay keyed by variable, so a ranged *field* proves nothing
until it is read into a local (`const p = this.pos`). That is the advice the
performance gate already gives ("reading an element into a local once").

**Entry checks are judged by the same walk.** `walkExpression` and
`walkDeclaration` gain a judge at each §6 entry, which records a verdict in a
new side table, `program.nodeProvenRange`. The emitter reads it the way it
reads `nodeProvenIndex`, following "the checker records, the emitter reads".
An entry of an `i32` local `v` into `[Lo, Hi]` is proven when:

- the lower end holds: `Lo` is `-2147483648`, or `Lo <= 0` and
  `knownNonNegative(state, v)`; and
- the upper end holds: `Hi` is `I32_MAX`, or `maxIndexOf(state, v)` is a bound
  (not `-1`) of at most `Hi + 1`.

`Lo > 0` is never proven from flow, because `orderFacts` records no lower
bound but zero. §11 leaves that family open instead of adding it here.

**The unsigned widths gain their upper half for free**, since
`declaredRange` covers them, and `initialiserFacts` gives `const k = toI32(x)`
the fact `maxIndex(k, Hi + 1)` from `declaredRange(x.type)` when
`Hi < I32_MAX`, the way it already
treats `toI32(w.length)` as the length. That is sound for the reason the
lower bound is: the type cannot hold anything else.

**A check that survives inside a loop warns**, as a new code in the §8
`performance` class next to `NL9007`, naming the guard that would prove it.
The gate in `tests/run.js` keeps `std/` and `examples/` at zero warnings of
it. `self/` is ratcheted in `tests/perf-baseline.json` like every other code.

The property-path facts of #106, being built in parallel, key *length* facts
by path. They compose with this and neither depends on the other.

---

## 9. Interop and `-g`

Every spelling here is one G8 already chose.

| Surface | `getByte(buf: u8[], i: integer<0, 255>): u8` | `Box<integer<0, 255>>` |
| --- | --- | --- |
| LLVM | `i32 %i` | `%struct.Box$rng.p0.p255` |
| C header | `int32_t i`. The comment above the prototype gives the source signature with the range, where G8 puts an instantiation's display name | `struct nish_gen_Box_rng_p0_p255` (`cStructName`) |
| `.d.ts`, wasm loader | `i: number`, with the range in the comment | `nish_gen_Box_rng_p0_p255` (`jsExportName`) |
| N-API | read with `napi_get_value_double`. The value must be an integer in `[0, 255]`, otherwise `napi_throw_range_error` names the function, the parameter and the range | as `.d.ts` |
| DWARF | `!DIDerivedType(tag: DW_TAG_typedef, name: "integer<0, 255>", baseType: <int>)` | `name: "Box<integer<0, 255>>"`, `linkageName: "Box$rng.p0.p255"` |

**Where the check lives at an ABI boundary: the linkage condition.** A caller
can prove an entry only if every caller is visible, which is exactly
`privateResultAbi` in `self/emit_result.ts` (`strictExports && !exported`,
wp15 §7b). W3 renames it `privateAbi`, since it now decides more than the
`Result` ABI, and the inline copy of the test in `self/interop_abi.ts` calls
it too. Where it holds, ranged parameters are checked at each call site,
where the facts are. Anywhere else the callee checks them in its prologue and
its callers skip theirs. The two bridges check again before the
call, so a JavaScript host sees a `RangeError` and not a process exit. The
value is read as a double because `ToInt32` would wrap 4294967301 to 5, which
is in range. `RangeError` is also what JavaScript throws for
`new Uint8Array(-1)`.

**A range in a non-scalar exported position is not described.** An
`integer<0, 255>[]` parameter, or a record with a ranged field, is data the
host writes, and nothing checks it on entry. Such a function gets the
existing header line, "not declared; no C spelling for one of its types", and
the matching omission in the other sidecars. That is a skip already in
`self/interop_header.ts`, so no new refusal is needed. **A `declare function`
may not mention a ranged type** at all. The range would be a promise the C
side never made, which is [wp27-ffi.md](wp27-ffi.md)'s objection to every
attribute on a foreign callee. W1 refuses it.

**DWARF is a typedef, because LLVM 18 has no subrange type.** DWARF's own
answer to a ranged scalar is Ada's `DW_TAG_subrange_type` with
`DW_AT_lower_bound` and `DW_AT_upper_bound`, but LLVM 18 cannot write one:

```bash
$ llvm-as sr.ll          # !DISubrangeType(name: "integer<0, 255>", baseType: !4, lowerBound: i64 0, upperBound: i64 255)
llvm-as: sr.ll:10:6: error: expected metadata type
$ llvm-as td.ll          # !DIDerivedType(tag: DW_TAG_typedef, name: "integer<0, 255>", file: !1, baseType: !4)
exit 0
```

(`Ubuntu LLVM version 18.1.3`, a one-function module in the scratch
directory.) A typedef gives a debugger the source spelling and `int`'s
encoding, which is §6.7's rule of wp18: the display name is the source
spelling. When the toolchain floor moves past LLVM 18, the typedef can become
a subrange type without changing anything a user writes.

---

## 10. Stages, the freeze, and the acceptance program

WP31 starts after G8's docs stage merges, because both edit `docs/LANGUAGE.md`.
It depends on G8's code for two things: `TypeTable.setDisplayName` (#164),
which with `instanceDisplayName` spells `Box<integer<0, 255>>`, and
`cStructName` / `jsExportName` (#165), which name it.

| Stage | Commit | Delivers | Tests |
| --- | --- | --- | --- |
| **W1** | `feat(checker)!: ranged integer types (WP31)` | `N_TYPE_LITERAL` and its oracle mapping. `K_RANGED`, `typeName` and `mangle`. The refusals of §4 and the `integer` name rule. The entry rules of §6, with every entry checked, since nothing is elided yet. The widening of §7. The `declare function` refusal. The `-g` typedef. The `runtime/nish.d.ts` line. The rule in `docs/LANGUAGE.md` under Types, `docs/AI.md`, a cookbook entry and a `CHANGELOG.md` line. | `rng_param`, `rng_generic`, `rng_widen` (`.ll` and `.out`); `rng_entry_panic` (exit 1, stderr); `dbg_rng`; a `reject_rng_*` case and a `tests/wordings/` program for each new code |
| **W2** | `perf(checker): prove range entries and index through declared ranges (WP31)` | §8: the two queries, `nodeProvenRange`, the unsigned upper bounds, the `toI32(u8)` fact, and the new `performance` code. | `perf_rng_loop`, `perf_rng_quiet`, `arr_bounds_ranged`, and `perf_rng_counter`, which is §7's trap: a warning, then a panic at run time |
| **W3** | `feat(interop): ranged parameters at the host boundary (WP31)` | §9: the prologue check under the linkage condition, the N-API and wasm `RangeError`, and the comments in the header and `.d.ts`. | `interop_rng_*`: the header under `clang -std=c11 -Wall -Wextra -Werror -pedantic`, the `.d.ts` under `tsc --noEmit`, and a Node call that must throw |
| **W4** | `docs(wp31): record the ranged-integer measurements` | the acceptance program below, committed to `bench/`, and its numbers written into this note and into wp15 item 6 | the programs themselves, and their checksums in `bench/run.mjs` if they join the suite |

**The rolling freeze.** `self/` is built by the last release. It cannot write
`integer<…>` in its own source until the release after W1 lands, because the
seed's parser has no `N_TYPE_LITERAL`. The `nish.d.ts` line is harmless before
that (§3a). Adopting ranges in `self/` is a change of its own, measured
against `tests/perf-baseline.json`, and the prediction is modest. wp15 §2.4
counts seventeen checks that survive inside loops in `self/`: two arrays the
program keeps the same length, a `min(a.length, b.length)` cursor, a merge
sort's three indices into two buffers. None is an index into a table of known
size, which is the only thing a range proves.

**The acceptance program.** wp15 item 6 measured **1.069x** on item 3's
cursor against a 1.082x `--unchecked-indexing` floor, under the protocol wp15
§2 states, with the hot `@scan` byte-identical to the unchecked build's. The
cursor's shape is pinned by `tests/cases/str_bounds_proven`, whose golden has
no `nish_panic_index`, but the timed program is not in the tree. So W4, under
that same protocol, does three things in order:

1. **Commit the cursor** as `bench/cursor.ts` and re-measure today's
   proven/unchecked pair on it, so that 1.069x is re-derived on a file anyone
   can run before anything is compared with it.
2. **The cursor must not regress, and must say why.** Its bound is
   `s.length`, which no range can state (§2), so the criterion is that
   `@scan` stays byte-identical to the unchecked build and
   `str_bounds_proven.ll` does not move. The same program with the cursor
   declared `integer<0, …>` must produce §8's warning on each advance, as §7
   predicts.
   Declaring the cursor is the mistake the warning exists for.
3. **`getByte` is judged by the IR the frontend writes, with the time
   reported.** Using §2's program with `i: integer<0, 255>`: `@getByte` must
   have no `nish_panic_index` call; it and `@sumCalled` must reach
   `{ nounwind willreturn readonly }`, as `@sumInline` does today; and the
   entry at the call in `@sumCalled` must be proven by `i < 256`, so it
   compiles to nothing. The wall-clock ratio against `--unchecked-indexing` is
   measured and written down whatever it is. §2's `opt -O3` result predicts
   about 1.00x on a closed program, and if that is what it measures, the note
   says the declared range is a frontend fact and not a speed-up, as wp15 §2b
   said of counted loops.

No number here has been measured for the declared form. §2 and §9 give the
runs this note did make, with their commands.

---

## 11. Open

- **A lower-bound family.** A fact `i >= n` for `n > 0` would prove entries
  into ranges that do not start at zero. `orderFacts` deliberately records
  only zero, and no program has shown the need yet.
- **Merging instantiations that differ only by range.** `identity<integer<0, 9>>`
  and `identity<i32>` compile to the same body under two names. Whether that
  is worth erasing ranges during inference, or merging the functions, is a
  code-size question for a real program. §7 keeps the range until one is
  measured.
- **A constant as a bound** (`integer<0, MAX>`). TypeScript cannot write it:
  a `const` is a value, and a type argument cannot name one without `typeof`,
  which Phase 0 forbids. It stays refused until TypeScript can say it.
- **The other half of wp15's example.** `FixedBuffer<256>` states a length
  floor in a type, and that is what §2 shows a range needs next to it. It is a
  const generic, which §4 declines here. A length guard is the spelling until
  it is designed.
- **`x & 255` and `Math.min(x, 255)` as fact sources.** Both would be sound,
  and both are the kind of peephole wp15 §2 refused inside the proof. Each
  would be its own change with its own case, and only once a measurement asks
  for it.

---

## 12. Appendix: the programs this note ran

`getbyte.ts`, compiled with `build/nish getbyte.ts -o getbyte.ll` for §2's
table:

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

`examples.ts`, for §3a:

```ts
// The WP31 examples, as tsc --strict reads them.

const getByte = (buf: u8[], i: integer<0, 255>): u8 => {
  if (buf.length < 256) {
    return 0;
  }
  return buf[i];
};

const clampSigned = (x: integer<-128, 127>): i32 => x;

export const main = (): number => {
  const table: u8[] = new Array<u8>(256);
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    const b: integer<0, 255> = i;
    sum = sum + getByte(table, b);
  }
  const low: integer<0, 9> = 7;
  const wide: i32 = low;
  const next: i32 = low + 1;
  return sum + wide + next + clampSigned(-5);
};

// What tsc accepts and nish refuses: a non-literal bound, Lo > Hi, a bound
// outside i32, and an out-of-range literal.
export const notLiteral = (x: integer<number, 3>): i32 => x;
export const inverted = (x: integer<10, 0>): i32 => x;
export const tooWide = (x: integer<0, 4294967295>): i32 => x;
export const outOfRange: integer<0, 9> = 12;
```

`refused.ts`:

```ts
// A bound that is not a number is the one thing tsc refuses too.
export const notNumber = (x: integer<"a", 3>): i32 => x;
```
