# WP65: The surface a lexer port asked for

**Status: proposed, design only; nothing in `runtime/`, `src/` or `std/` is
built.** [LANGUAGE.md](LANGUAGE.md) stays normative. The anchors are at
`7c7d58f8`.

A table-driven lexer, ported to Nish and profiled natively, ran into five
gaps. They are recorded here because the Ruby and Kotlin lexers planned after
it will hit the same ones. One of the five was already built. Of the other
four, three are additions with no decision left to make. The fourth would
reverse a rule LANGUAGE.md states on purpose, so it waits on the owner.

| # | Asked for | State at `7c7d58f8` | Stage |
| --- | --- | --- | --- |
| 1 | A literal `u8[]` / `i32[]` module constant, for a 256-entry byte-class table | **Built**: [Constant tables](LANGUAGE.md#constant-tables) | — |
| 2 | `indexOf(byte, from)` on `u8[]` through `memchr`, and a sub-range compare through `memcmp` | Missing | S1 |
| 3 | An array allocation that skips the zero fill, and one standard `grow` | Missing | S2 |
| 4 | Field initializers that are not literals (`xs: i32[] = []`) | Missing | S3 |
| 5 | `i32.toString()` | Refused by rule | S4 *(decided: D1b)* |

## 1. Constant tables: built, and how the port missed them

`const CLASS: readonly u8[] = [0, 0, 1, ...]` is a constant table. Its
elements are folded at compile time into one read-only data global with a
constant header over it (`tests/cases/const_array_u8`, `const_array_numeric`).
With `c: u8`, `CLASS[c]` into a 256-entry table is one load whose bounds check
the prover has already discharged. That is the lexer's hot loop.

The port wrote `const CLASS: u8[] = [...]`, which is refused with
`` must be declared `readonly u8[]` `` (`reject_const_array`). The diagnostic
names the fix. What the port's author remembered was the older rule, "number,
boolean or string". The guide (`docs/guide/language/arrays-and-strings.md`) and
the cookbook (`docs/IR_COOKBOOK.md`, "Constant tables") already describe
constant tables. What neither shows is the lexer's case: a 256-entry
byte-class table indexed by a `u8`, with the bounds check gone. That example
lands with S1.

## 2. Byte search on `u8[]` (S1)

Today a native byte search on a file means copying it into a string, because
the string runtime is the one place `memchr` is reached:
`nish_str_index_of` with a one-byte needle (`runtime/runtime-text.c`,
`src/emit-strings.ts`). `Array.indexOf` takes one argument, and a `fromIndex`
is refused (`runtime/nish.d.ts`, `interface Array<T>`). `std/bytes.ts` has no
range compare. Both `memchr` and `memcmp` are already reserved in
`src/c-symbols.ts`.

**The surface:**

- **`indexOf(x, fromIndex)` on every array**, as TypeScript has it: the start
  is clamped to `[0, length]`, and a negative start counts from the end. On a
  `u8[]` or `i8[]` with a numeric `x`, the search lowers to one `memchr` over
  `[from, length)`. Any other element type keeps today's loop.
- **`indexOfByte(b, byte, from, to)` in `std/bytes.ts`** clamps its range the
  way `skipBlank` does, so no range panics. Natively it is a kernel seam
  (`src/kernels.ts`) lowered to `memchr`, and under Node it is the plain walk.
- **`equalBytes(a, aFrom, b, bFrom, count)` and
  `compareBytes(a, aFrom, b, bFrom, count)` in `std/bytes.ts`** are `memcmp`
  over two sub-ranges. A range past either end panics as an index would: they
  check rather than clamp, because a short compare that answered `true` would
  be wrong.

**Security.** All three are variable-time. Their doc comments say so, as
`skipBlank`'s does, and point to `timingSafeEqualAt` in `std/crypto/ct.ts` for
secret data. No
record is needed, because none of them reads the network, the terminal or
another process.

**Tests:** a golden `.ll` per lowering, native round trips with expected
stdout at both edges of each range, a differential run against Node for the
`indexOf` clamp, and a negative test per refused element type.

## 3. Allocation without the zero fill, and `grow` (S2)

`new Array<T>(n)` always ends in one `llvm.memset` of the whole data
(`src/emit-arrays.ts`, the `new Array` lowering). In the port's profile that
zeroing was about 1.8% of instructions, the top `memset` callers. Every file
also defines its own `growI32` and friends: allocate a bigger array, copy the
old one in, and pay for a zero fill that the copy then overwrites.

**Why not an uninitialised `length`.** An array whose elements past the last
store are uninitialised exposes whatever the arena held before, which can be
another value's bytes. In LLVM, a load from uninitialised memory is `undef`.
Nish's guarantee that every read has a defined value does not survive that.
So the fill is skipped only where nothing can read the slots before they are
written:

- **`withCapacity<T>(n)` in `std/array.ts`** answers a `T[]` of length 0 and
  capacity `n`, so the next `n` pushes never reallocate. Nothing is filled,
  because no slot past `length` is readable.
- **`grow<T>(xs, n)` in `std/array.ts`** answers `xs` with its length raised
  to at least `n`. Only the new slots are zero-filled, and the old ones move
  with one copy. This replaces every hand-written `growI32`.
- **The compiler drops a fill that is overwritten before any read**, the same
  reasoning `sortWith`'s scratch already uses (`isSortInstance` in the same
  lowering). This covers `new Array<T>(n)` followed by a counted loop that
  stores every index from 0 to `n - 1` before the array escapes or is read.
  It is the larger change, and it is measured on its own.

A `Secret` array keeps its fill, and `nish:secret`'s wipe rules are untouched.

**Tests:** the IR of each case showing the `memset` present or gone, a
negative test showing that a read before the loop keeps the fill, and the
port's profile re-measured with a `Measured:` figure and its noise band.

## 4. Field initializers that are not literals (S3)

A class field's initializer must be a literal
(`` initializers must be literals (assign other values in the constructor) ``,
`checkLiteralInitializer` in `src/structs.ts`, `tests/cases/cls_initializers`).
So `xs: i32[] = []` goes into every constructor by hand.

**The rule:** an initializer may be any expression that does not read `this`,
a constructor parameter, or a local of the constructor. Examples are `[]`,
`new Array<T>(n)`, `new Map<K, V>()`, a constant, a call to a top-level
function, and an enum member. TypeScript runs the initializers in declaration
order before the constructor body, and Nish does the same. A class without a
constructor gets the implied one. Definite assignment counts an initialized
field as assigned, so the existing `has no initializer and no constructor
assigns it` check needs no new case.

The literal path stays as it is: a literal initializer is still one store with
no code, so no IR in today's corpus moves. Some places refuse a non-literal
initializer under their own rules: an FFI struct (whose `new` zero-fills),
module storage, root storage, and a `Secret` field.

**Tests:** native round trips for `[]`, a `Map`, a call and declaration order;
negative tests for `this`, for a parameter, and for each refusing place; the
`src/` freeze holds, since `src/` may not use the form until the release after
it ships.

## 5. `toString()` on a number (S4, decided: D1b)

LANGUAGE.md says there is no `toString`: template literals and `console.log`
convert numbers. `String(n)` on a number is refused as
`` Unknown function `String` `` (`tests/cases/reject_string_call_non_enum`),
because `String` converts only a string enum's value.

The port reached for `n.toString()` first, as any TypeScript author does. Two
options:

- **D1a: build it.** `n.toString()` with no argument is exactly
  `` `${n}` ``, including the shortest round-trip digits for an `f64`. With a
  radix from 2 to 36 it is JavaScript's. `String(n)` on a number becomes the
  same conversion. The cost is two spellings of one conversion.
- **D1b: keep the rule and improve the refusal.**
  `` Unknown method `toString` on i32 `` names the template literal that
  converts the number, and `String(n)` gets the same hint.

The recommendation was D1a without a radix: it is what TypeScript authors
write, and under Node it means exactly what it means natively. The owner chose
D1b (#1632): a number's `toString()` with no argument is refused as
`` Unknown method `toString` on i32; use a template literal: `${n}` ``,
spelled with the receiver the program wrote, and its quick-fix writes that
literal (`tests/cases/reject_num_tostring*`). With a radix the refusal names
no spelling, since a template literal has none. `String(n)` keeps its
refusal.

## 6. Stages

- **S1:** `indexOf` with `fromIndex`, `memchr` on byte arrays, and
  `indexOfByte`, `equalBytes` and `compareBytes` in `std/bytes`, with the
  constant-table docs from §1.
- **S2:** `withCapacity` and `grow` in `std/array`. Then the dropped fill,
  measured on its own.
- **S3:** field initializers that are not literals.
- **S4:** the `toString` refusal names the template literal (D1b).

S1 to S3 do not depend on one another. Each one ships its LANGUAGE.md rule, its
cookbook entry and its guide-page change in the same PR, as the definition of
done asks.

## 7. Not planned

An uninitialised `length` (§3), a `memchr` for wider element types, and a
`toString` on arrays or classes.
