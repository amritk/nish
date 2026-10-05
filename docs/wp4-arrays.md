# WP4: Arrays

**Status: landed** before the first release (merged as `wp4/arrays`,
3bd005e): `T[]`/`Array<T>` with bounds checks, literals, `new Array<T>(n)`,
`push`, `for...of` and `--unchecked-indexing`. The typed-array aliases came in
WP4b (dce2634). Much has been built on it since (below). The rules are
normative in [LANGUAGE.md](LANGUAGE.md)
([Element access](LANGUAGE.md#element-access),
[Array literals](LANGUAGE.md#array-literals),
[Arrays and strings as receivers](LANGUAGE.md#arrays-and-strings-as-receivers)),
and the IR is in [IR_COOKBOOK.md](IR_COOKBOOK.md). The code is
`src/arrays.ts` (checking) and `src/emit-arrays.ts` (lowering); the goldens
are `tests/cases/arr_*.ts`.

## Layout (ABI)

An array value is a pointer to an arena-allocated header that every element
type shares:

```llvm
%struct.nish_array = type { i64, i64, i8* }     ; { len, cap, data }
```

```c
typedef struct nish_array { uint64_t len; uint64_t cap; char *data; } nish_array;   /* runtime/nish.h */
```

`data` points at `cap` elements of one fixed size, 8-byte aligned; an element
access bitcasts `data` to `T*` and indexes with an `i64`. The 24-byte header
and the data are separate allocations so that a slice could share storage.
`data` is `null` only for an empty literal (`cap = 0`), and nothing reads
through it before the first `push` grows it. Because only the element size
and the `T*` cast differ, `number[]`, `string[]` and `number[][]` share one
header type. (Since WP15 §2a an array of `interface` records stores the
records themselves, end to end, rather than pointers to them:
[Arrays of records are contiguous](LANGUAGE.md#arrays-of-records-are-contiguous).)

The runtime half is three functions in `runtime/runtime.c` and the
freestanding `runtime/runtime-wasm.c`: `nish_array_grow(hdr, elemSize)`
doubles `cap` (4 from 0) and moves the elements to fresh arena storage;
`nish_panic_index(idx, len)` prints `index out of range: <idx> >= <len>` and
exits 1, declared `noreturn cold`; `nish_alloc_array(elemSize, len)` is for
hosts (WP8) and is never called by compiled code. Header and element storage
otherwise come from the compiler's inline allocator.

## Decisions

- **One element type per array**, and **`[]` needs a contextual type**
  (an annotation, return type, assignment target, `push` argument, enclosing
  literal or parameter). Nothing is inferred from later pushes.
- **`new Array<T>(n)` zero-fills**, because Nish has no holes. A pointer
  element type would zero-fill to null, which no non-nullable value may be
  (`nonnull` is emitted everywhere), so `new Array<string>(n)` is refused in
  favour of `[]` and `push`; since WP6 a `T | null` element type is allowed,
  whose zero fill is `null`.
- **The bounds compare is unsigned**, so a negative index (sign-extended to
  `0xFFFF...`) fails like any other.
- **`const xs` freezes the binding, not the contents**, as in JavaScript.
- **`.length` is read-only.**
- **`for (const x of a)` re-reads `a.length` every pass**, so a `push` in the
  body extends the loop, as JavaScript's iterator does. The loop condition is
  the bounds check, so no other check is emitted.
- **Evaluation order follows JavaScript**: `a[i] = v` evaluates `a`, `i`, `v`,
  then checks and stores; `a[i] op= v` checks and loads before evaluating
  `v`; `push(v)` evaluates `v` before reading the length.
- **Arrays compare by reference** with `===`/`!==`.
- **Typed-array names are aliases, not types.** `Int32Array`, `Float64Array`
  and `BigInt64Array` (later also `Float32Array`) resolve to the same type as
  `i32[]`, `f64[]`, `i64[]`: no second layout, no view semantics, no
  conversion. They exist for the host boundary, where `--emit-dts` and
  `--emit-napi` map these element types to JavaScript typed arrays
  ([wp8-interop.md](wp8-interop.md)). `boolean[]` has none, because a host
  `Uint8Array` could hold values other than 0 and 1, which an `i1` load may
  not see. (A receiver spelled with an alias has since lost `push` and `pop`,
  as in TypeScript.)

## Bounds-check policy

Every checked `a[i]` loads `len`, compares `icmp ult`, and branches to a cold
block that calls `nish_panic_index` and is `unreachable`: one compare and one
predicted-not-taken branch. `--unchecked-indexing` removed the compare, the
branch and the block, making an out-of-range index undefined behaviour; it
existed for benchmarks and code that carries its own proof.

The check has an attribute cost: `nish_panic_index` is `noreturn` with effect
`write`, so a function with a checked index loses `willreturn` and cannot be
`readonly`.

### Vectorisation

`tests/run.js` runs `opt -O2 -mtriple=x86_64-unknown-linux-gnu` over
`arr_sum.ts` in both modes. Unchecked, the sum loop vectorises to
`<4 x i32>`. Checked, the standalone `sum` does **not**: `opt` hoists the
length compare out of the loop, but the branch to the panic block stays
inside it, and LLVM 18's loop vectoriser does not handle a loop with a second
exit. Once `sum` is inlined into `main`, where the length is a known constant,
the check folds and the same vector body appears. Both facts are asserted.

The follow-up this pointed at was a range check hoisted before a counted loop
(Rust's `assert!(n <= a.len())`), so that checked code vectorises without
inlining. What was built instead is the checker's flow-sensitive proof that
removes a check outright (WP15 §2, `src/bounds.ts`,
`tests/cases/arr_bounds_proven`); [wp9-optimisation.md](wp9-optimisation.md)
records the case that motivated it.

## Attributes

| Attribute | Rule |
| --- | --- |
| `noundef nonnull align 8` (array params and returns) | An array value is never null (a `T[] \| null` carries none of these), and headers come from the 8-aligned allocator. |
| `readonly` (param) | The body never stores through the parameter (`p[i] = v`, `p[i] op= v`, `p.push(v)`), **nor through anything indexed from it: `p[i][j] = v` counts as a write through `p`, conservatively**; it is never aliased (an alias could be written through, and LLVM may fold the alias back into `p`); and it is passed only to callees whose matching parameter is `readonly`. |
| `nocapture` (param) | Every use is an indexing base, a `.length` or `push` receiver, a `for...of` source, an `===` operand, or an argument a callee does not capture. |
| no `noalias` | Two array parameters may be the same array, and arrays are mutable. |
| `readonly` (function) | Element reads, `.length` and `for...of` read memory; a checked `a[i]` adds the writing `nish_panic_index`. |
| `willreturn` | Lost by a checked `a[i]` and by any loop that is not counted. A `for...of` is counted when its body cannot extend the array: as built, no `push` on any array (the source may be aliased) and no call to a user function (which could push through an alias). |

The parameter rules are a fixpoint over the whole program's call graph: a
parameter handed to a callee inherits the callee's facts for the matching
parameter, and an unknown callee counts as both writing and capturing. The
fixpoint is optimistic on cycles, which is sound because a parameter is only
ever marked written when some actual store reaches it.

## What came later

Everything WP4 listed as left out has since been decided:

- `pop`, `indexOf`, `join`, `set` and `fill` exist
  ([Arrays and strings as receivers](LANGUAGE.md#arrays-and-strings-as-receivers));
  holes, spread and `length` assignment are still refused.
- Escape-analysed stack allocation of arrays that do not outlive the function
  came with WP6 ([wp6-memory.md](wp6-memory.md)).
- Bounds checks the checker can prove are not emitted (WP15 §2), and a
  surviving one warns.
- The global `--unchecked-indexing` is deprecated: it reaches only the entry
  package, and `uncheckedGet`/`uncheckedSet` from `nish:unsafe` are the
  per-site replacement that a per-file flag would have been
  ([`nish:unsafe`](LANGUAGE.md#nishunsafe-unchecked-access-and-defined-wrapping)).
