# WP17: `Result` across the ABI

**Status: complete** (#8, with the private per-arm ABI of §4 following under
WP15). [wp16-results.md](wp16-results.md) §2 shipped `Result<T, E>` as a
pointer to an arena struct and left three things: return small `Result`s by
value; let a `Result` cross the host boundary (`--emit-header`, `--emit-dts`,
`--emit-napi`); and describe its fields in DWARF. The last two needed no ABI
decision; the first did, and this note records it. The normative rules are in
[LANGUAGE.md](LANGUAGE.md#result-and-error-handling) and the IR in
[IR_COOKBOOK.md](IR_COOKBOOK.md).

Tests: `tests/cases/res_by_value`, `res_by_value_propagate`,
`res_by_value_payloads`, `res_by_value_param`, `res_export`, `dbg_result`,
`reject_result_by_value_unchecked`, the "WP17: a `Result` across the host
boundary" block in `tests/run.js`, and `bench/result`.

## 1. The decision

**A `Result` whose two payloads are each a scalar of at most four bytes
travels by value, packed into a single `i64`** — returned and passed. Every
other `Result` keeps WP16's pointer. Eight bytes is not a tuning knob: it is
the largest value the six supported targets agree about (§2).

```
bits  0..31   the discriminant: 1 for Ok, 0 for Err
bits 32..63   the live arm's payload, zero-extended (f32 through a bitcast)
```

The dead arm is not represented, which is what makes `Result<i32, i32>` —
twelve bytes as a struct — fit. The tag gets 32 bits rather than one byte so
the payload's offset does not depend on its alignment: one shift amount in the
emitter and one union offset in the header. Every supported data layout is
little-endian, so bit 0 of the word is byte 0 of the struct.

`TypeTable.resultByValue` in `src/types.ts` is the one place that decides. The
payloads that qualify are `void`, `boolean`, `u8`, `u16`, `i32`, `u32` and
`f32`; `i64`, `u64` and `f64` are too wide, and a string, array, class,
nullable or nested `Result` is a pointer that would need the whole word.

## 2. Why not the other two

### (b) A real by-value aggregate

LLVM does not lower an aggregate to a platform's calling convention; the
frontend does, per target. `struct R { bool ok; int32_t value; int32_t error; }`
returned from `clang --target=<triple> -O2 -S -emit-llvm`:

| triple | what clang returns |
| --- | --- |
| `x86_64-unknown-linux-gnu`, `x86_64-apple-darwin` | `define { i64, i32 } @agg_12(i32)` |
| `aarch64-unknown-linux-gnu`, `aarch64-apple-darwin` | `define [2 x i64] @agg_12(i32)` |
| `wasm32-unknown-unknown`, `wasm32-wasi` | `define void @agg_12(ptr sret(%struct.R), i32)` |

Three signatures for one C type, and the same split in argument position. The
compiler emits target-neutral IR by default so one `.ll` links against a host
built for any target; (b) would have meant by-value returns only under
`--target`, and a `.ll` no longer portable between hosts.

### (c) `sret`

Uniform, because every target falls back to it, but the value goes through
memory on every call that is not inlined: the caller reserves a slot, the
callee stores, the caller loads. It also costs an argument register and makes
the return type `void`. §4 measures it at about half the win of (a).

### And why not a wider scalar

`i128` would have admitted 16-byte `Result`s, but x86-64 returns it as
`{ i64, i64 }` while aarch64 and wasm32 return `i128`. `i64` is the only width
where all six agree, which is where the four-byte payload rule comes from.

## 3. Why the C header can still describe it

`--emit-header` writes the encoding as a C type:

```c
typedef struct nish_result_i32_i32_word {
  int32_t ok;                                   /* 1 = value, 0 = error */
  union { int32_t value; int32_t error; } as;   /* the arm `ok` selects */
} nish_result_i32_i32_word;
NISH_RESULT_ASSERT(sizeof(nish_result_i32_i32_word) == 8, "...");
```

and clang, told to return that type, produces the declaration the module
already defines, on every native target:

```
x86_64-unknown-linux-gnu    declare i64 @half(i32 noundef)
aarch64-unknown-linux-gnu   declare i64 @half(i32 noundef)
x86_64-apple-darwin         declare i64 @half(i32 noundef)
aarch64-apple-darwin        declare i64 @half(i32 noundef)
```

So the header is not a description of the ABI that must be kept true; it is
the same declaration, in both directions. The WP17 block of `tests/run.js`
compiles a `-Wall -Wextra -Werror -pedantic` C driver against the header for
`tests/cases/res_export.ts` and calls `half` and `checkPort` (by value),
`describe` (a by-value parameter) and `openFile` (an arena pointer, because its
error arm is a struct). `NISH_RESULT_ASSERT` is `_Static_assert` where the host
has it, so a compiler that disagreed fails the build rather than misreading a
register.

wasm32 is the exception — an eight-byte C struct goes through `sret` there —
and it costs nothing in practice, because the wasm boundary the compiler
generates is JavaScript: `--emit-dts` declares
`{ ok: true; value } | { ok: false; error }` and the loader unpacks the bigint.
`--emit-napi` hands a native addon's caller the same object.

## 4. What it is worth, measured

Performance is the tiebreaker, measured
([wp14-selfhost.md](wp14-selfhost.md) §5). The program:

```ts
function half(n: i32): Result<i32, i32> {
  if (n % 2 !== 0) { return Err(n); }
  return Ok(n / 2);
}
function use(n: i32): i32 {
  const r = half(n);
  if (r.isErr()) { return 0; }
  return r.value;
}
```

**The assembly**, with `half` inlined into `use` (`--profile speed`): on
x86-64 the arena pointer cost 47 instructions, 8 blocks and 3 calls (the arena
scope, the bump, the cold grow); the packed word is 14 instructions in one
block with no calls and no memory. aarch64 went from 50 instructions to 10.
SROA sees through the entry-block object the caller unpacks into, which is
why the rest of WP16's lowering could stay as it was.

**The clock**, `use(i)` over 2 × 10^8 iterations on x86-64: 0.50 s as an arena
pointer, **0.14 s** packed — **3.5× faster**, same checksum.

**Against `sret`**, with `half` `noinline` so the call boundary is real
(hand-written `.ll` mimicking each lowering, since the compiler implements
only one): arena pointer about 1,030 ms, `sret` about 720 ms (1.43×), packed
`i64` about 480 ms (**2.09×**). The win survives a real call, and `sret` gets
about half of it.

### Where the packing still costs something

`bench/result` against C and Rust twins, when WP17 landed:

| the same program, written four ways | time |
| --- | --- |
| Rust `Result<i32, i32>` (two SSA values throughout) | 251 ms |
| C, an eight-byte struct clang coerces at the boundary | 444 ms |
| C, the word assembled by hand with `<< 32` and `\|` | 653 ms |
| **Nish** (packed word) | **650 ms** |

C written the way `nish` emits matched Nish exactly, so this was the shape and
not the code generation. What separates the fast rows from the slow ones is
whether the ok arm and the error arm are ever separate SSA values. Respelling
the pack the way clang does (through a two-word alloca) gave byte-identical
assembly, so the shorter `shl`/`or` IR stayed (`src/emit-result.ts`).

### That step has since been taken (WP15), in two halves

A non-exported function takes and answers a by-value `Result` in a private
shape, on exactly the condition that gives it `internal` linkage: `privateAbi`
in `src/emit-result.ts` is `strictExports && !exported`, so
`--no-strict-exports` turns it off with the linkage, a cross-module call is
always packed, and the interop generators, which see exported functions only,
are untouched.

- **Half one: the tag leaves the word**, `{ i1, i32 }` (rustc's `ScalarPair`).
  `bench/result` went from 650 ms to **464 ms**, level with C's 444, and no
  further.
- **Half two: one slot per arm**, `{ i1, i32, i32 }` (#39). With one payload
  slot, `half`'s two returns meet in a `phi(n, n >> 1)` that instcombine folds
  into a *variable* shift the enclosing `select` cannot undo; patching that one
  instruction to a constant shift took the loop from 472 ms to 256 ms. With a
  slot per arm the dead slot is `undef`, the `phi` disappears and the shift is
  constant. `bench/result` went from 1.84× behind Rust `-O3` to **1.00×**, and
  left the WP9 gap table. `armsForArm`, `armsForObject` and `unpackArms` build
  that shape; `packArm`, `packObject` and `unpackResult` still serve every
  packed boundary.

Current figures are in [BENCHMARKS.md](BENCHMARKS.md).

## 5. What is *not* by value

- **Large `Result`s**, by §1's rule. They stay the arena pointer, and
  `--emit-header` declares the in-memory struct and a pointer to it.
- **A `Result` in a field or an array element**, which has to outlive the
  frame. That is why a by-value *parameter* is not trivial: the callee unpacks
  the word into an object, and if any use stores that pointer somewhere
  longer-lived the object must be an arena bump rather than an `alloca`.
  `EscapeResult.stackParams` makes that decision with the same `localOutcome`
  walk WP6 uses for a local holding an allocation (`res_by_value_param`).
- **The in-memory layout.** `%struct.nish_result.<T>.<E>` is unchanged. The
  word exists only at the boundary: the callee packs where it would have
  allocated, and the caller unpacks into the entry-block object the rest of the
  lowering already understands.

## 6. Both compilers

WP17 landed in stage0 and `src/` together, as WP16 had, and the IR oracle held
them byte-identical (274 of 274 programs) before the bootstrap was allowed to
reach its fixed point. stage0 is gone now
([wp19-stage0-retirement.md](wp19-stage0-retirement.md)); the DWARF for a
`Result` (`src/debug.ts`, [§`-g` on both sides](wp14-selfhost.md#-g-on-both-sides))
and the C shapes above (`src/interop-*.ts`, [wp14-selfhost.md](wp14-selfhost.md)
§7) are `src/`'s like everything else.

**Nish-0 did not grow.** Rule 5 of [wp14-selfhost.md](wp14-selfhost.md) §6 did
not fire: the packing is shifts, `zext`, `trunc`, `select` and one `bitcast`,
all of which `src/` could already express, and no construct entered the
language. WP17 is a lowering of a type that already existed, so it ships no
new syntax, and its `reject_*` case pins that WP16's rules hold on the new
shape.
