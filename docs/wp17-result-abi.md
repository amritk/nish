# WP17: `Result` across the ABI

[wp16-results.md](wp16-results.md) §2 shipped `Result<T, E>` as a pointer to
an arena struct and said the reason was the C ABI rather than the design. It
left three things for this package, all of them recorded in the source:

1. return small `Result`s by value, so an inlined ok path costs no allocation;
2. let a `Result` cross the host boundary (`--emit-header`, `--emit-dts`,
   `--emit-napi`);
3. emit DWARF members for a `Result`, so `-g` describes the fields.

(2) and (3) needed no ABI decision. (1) did, and the rest of this note is it.
The normative rules are in [LANGUAGE.md](LANGUAGE.md#result-and-error-handling);
the IR is in [IR_COOKBOOK.md](IR_COOKBOOK.md).

Tests: `tests/cases/res_by_value`, `res_by_value_propagate`,
`res_by_value_payloads`, `res_by_value_param`, `res_export`, `dbg_result`,
`reject_result_by_value_unchecked`, the "WP17: a `Result` across the host
boundary" block in `tests/run.js`, `bench/result`, and the S3/S4 oracles and
the bootstrap in `tests/self/`.

## 1. The decision

**A `Result` whose two payloads are each a scalar of at most four bytes
travels by value, packed into a single `i64`** — returned *and* passed.
Everything else keeps WP16's pointer. That is option (a) of the three the
package was framed with, and the threshold is not a tuning knob: eight bytes
is the largest value the six supported targets agree about.

```
bits  0..31   the discriminant: 1 for Ok, 0 for Err
bits 32..63   the live arm's payload, zero-extended (f32 through a bitcast)
```

The dead arm is not represented at all. That is the whole difference from the
in-memory `{ i1 ok, T value, E error }`, and it is what makes it fit:
`Result<i32, i32>` is twelve bytes as a struct and eight as this word.

The tag gets a full 32 bits rather than the one byte it needs so that the
payload's offset does not depend on the payload's alignment. Otherwise
`Result<boolean, boolean>` would put its payload at byte 1 and
`Result<i32, i32>` at byte 4: two shift amounts in the emitter and two union
offsets in the header, for one language rule. Every supported data layout is
little-endian (all six begin `e-`), so bit 0 of the word is byte 0 of the
struct and the encoding is exact rather than approximately right.

`resultByValue` in `src/types.ts` (and `TypeTable.resultByValue` in
`self/types.ts`) is the one place that decides, and the payload predicate is
the whole of it: `void`,
`boolean`, `u8`, `u16`, `i32`, `u32`, `f32`. `i64`, `u64` and `f64` are four
bytes too many; a `string`, an array, a class, a nullable or a nested
`Result` is a pointer, and a pointer payload would need the whole word.

## 2. Why not the other two

### (b) A real by-value aggregate

LLVM does not lower an aggregate to a platform's calling convention — the
frontend does, per target. That is not an opinion; it is measurable in one
command. `struct R { bool ok; int32_t value; int32_t error; }` returned from
`clang --target=<triple> -O2 -S -emit-llvm`:

| triple | what clang returns |
| --- | --- |
| `x86_64-unknown-linux-gnu` | `define { i64, i32 } @agg_12(i32)` |
| `aarch64-unknown-linux-gnu` | `define [2 x i64] @agg_12(i32)` |
| `x86_64-apple-darwin` | `define { i64, i32 } @agg_12(i32)` |
| `aarch64-apple-darwin` | `define [2 x i64] @agg_12(i32)` |
| `wasm32-unknown-unknown` | `define void @agg_12(ptr sret(%struct.R), i32)` |
| `wasm32-wasi` | `define void @agg_12(ptr sret(%struct.R), i32)` |

Three different signatures for one C type, and the same split in argument
position — `int32_t describe(struct R)` is `i32 @describe(i64)` on the four
native triples and `i32 @describe(ptr byval(%struct.R))` on both wasm32 ones.
`src/codegen/target.ts` emits
target-neutral IR by default — no `target triple`, no `target datalayout` —
precisely so one `.ll` links against a C host built for any of them, and
`--target` exists to pin the *layout*, not to change what the module means.
Choosing (b) would mean by-value returns only under `--target`, a `.ll` that
is no longer portable between hosts, and a header generator that has to say
so. It buys nothing over (a) that (a) does not already have.

### (c) `sret`

Uniform — every target above agrees, because `sret` is what they fall back to
— and it gives up the win the package exists for. The value goes through
memory on every call that is not inlined away: the caller reserves a stack
slot and passes its address in an argument register, the callee stores the
fields, the caller loads them back. §4 measures it: 1.5× slower than the
packed word on the same program. It also costs an argument register and makes
the function's return type `void`, so a `Result`-returning call can never
occupy a return register at all.

### And why not a wider scalar

`i128` was the obvious way to raise the threshold to a 16-byte `Result`
(`Result<f64, i32>`, `Result<i32, string>`). It is not uniform either:

| triple | `unsigned __int128 f(int32_t)` |
| --- | --- |
| `x86_64-unknown-linux-gnu`, `x86_64-apple-darwin` | `define { i64, i64 } @pack_128(i32)` |
| `aarch64-*`, `wasm32-*` | `define i128 @pack_128(i32)` |

`i64` is the only width where all six agree, and that is where the four-byte
payload rule comes from. It is a fact about the targets, not a guess about
what is worth packing.

## 3. Why the C header can still describe it

The point of (a) is that the header does not have to explain a private
convention. `--emit-header` writes the encoding as a C type:

```c
typedef struct amrit_result_i32_i32_word {
  int32_t ok;                                   /* 1 = value, 0 = error */
  union { int32_t value; int32_t error; } as;   /* the arm `ok` selects */
} amrit_result_i32_i32_word;
AMRIT_RESULT_ASSERT(sizeof(amrit_result_i32_i32_word) == 8, "...");
```

and clang, told to return that type, produces the declaration the module
already defines — on every native target:

```
$ clang --target=<triple> -O2 -S -emit-llvm host.c   # host.c calls half()
x86_64-unknown-linux-gnu    declare i64 @half(i32 noundef)
aarch64-unknown-linux-gnu   declare i64 @half(i32 noundef)
x86_64-apple-darwin         declare i64 @half(i32 noundef)
aarch64-apple-darwin        declare i64 @half(i32 noundef)
```

So the header is not a description of the ABI that has to be kept true; it is
the same declaration. The WP17 block of `tests/run.js` proves it end to end: a
`-Wall -Wextra -Werror -pedantic` C driver includes the generated header and
calls `half` (by value), `openFile` (an arena pointer, because its error arm
carries a struct) and `describe` (a `Result` *parameter*, which is a pointer
whatever its size) against the compiled `tests/cases/res_export.ts`.
`AMRIT_RESULT_ASSERT` — `_Static_assert` where the host compiler has it — pins
`sizeof(...) == 8` in the header itself, so a compiler that disagreed would
fail to build rather than mis-read a register.

wasm32 is the exception: there an eight-byte C struct is returned through
`sret` while a `uint64_t` is returned as a value, so a *C* host compiled for
wasm32 would have to read the word as a `uint64_t` rather than through the
typedef. That costs nothing in practice, because the wasm boundary this
compiler generates is JavaScript and not C: `--emit-dts` declares
`{ ok: true; value } | { ok: false; error }` and the generated loader unpacks
the bigint the export returns. `--emit-napi` does the same for a native
addon, handing JS the object it already models.

## 4. What it is worth, measured

§5 of [wp14-selfhost.md](wp14-selfhost.md) says performance is the tiebreaker
and that "faster" means measured. Everything below is one program:

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

compiled by two real compilers — the one at the commit before this package,
and this one — with `scripts/build.sh --profile speed` (`clang -O3`, LTO).
Nothing below is hand-written IR.

### The assembly

`half` is inlined into `use`, which is the case the package is named for.
**x86-64, before:**

```asm
;; WP16: a pointer to an arena struct. The bump survives inlining, because the
;; arena is a global and LLVM may not delete a write to it — and the caller
;; carries the WP6 arena scope for the Result it now owns.
use:  pushq  %r14
      pushq  %rbx
      pushq  %rax
      movl   %edi, %ebx
      callq  amrit_arena_mark@PLT       ; the scope
      testb  $1, %bl
      jne    .LBB1_1
      sarl   %ebx
      movq   amrit_arena@GOTPCREL(%rip), %rdx
      movq   8(%rdx), %rcx            ; arena.off
      leaq   16(%rcx), %rsi
      cmpq   16(%rdx), %rsi           ; arena.cap
      ja     .LBB1_8                  ; -> callq amrit_arena_grow
      movq   %rsi, 8(%rdx)            ; publish the new bump
      addq   (%rdx), %rcx
.LBB1_9:
      movb   $1, (%rcx)               ; store ok
      movl   %ebx, 4(%rcx)            ; store value
      jmp    .LBB1_7
      ...                             ; 47 instructions, 8 blocks, 3 calls
```

**x86-64, after:**

```asm
;; WP17: packed into i64. No memory, no frame, no call.
use:  movq   %rdi, %rax
      shlq   $32, %rax
      movl   %edi, %ecx
      sarl   %ecx
      shlq   $32, %rcx
      incq   %rcx
      testb  $1, %dil
      cmovneq %rax, %rcx
      movq   %rcx, %rax
      shrq   $32, %rax
      xorl   %edx, %edx
      testb  %cl, %cl
      cmovel %edx, %eax
      retq                            ; 14 instructions, 1 block, no calls
```

**aarch64, before** (50 instructions, 8 blocks, 3 calls — `bl amrit_arena_mark`,
`bl amrit_arena_release`, and the cold `bl amrit_arena_grow`) **and after:**

```asm
use:  asr  w9, w0, #1
      mov  w8, #1
      lsl  x10, x0, #32
      tst  w0, #0x1
      orr  x8, x8, x9, lsl #32        ; pack
      csel x8, x8, x10, eq
      lsr  x9, x8, #32                ; unpack
      tst  x8, #0x1
      csel w0, wzr, w9, eq
      ret                             ; 10 instructions, 1 block, no calls
```

The entry-block `alloca` the caller unpacks into is gone in both: SROA sees
straight through it, which is the whole reason the lowering can leave the rest
of WP16 alone and still cost nothing.

### The clock

`use(i)` in a 2 × 10^8 iteration loop, both binaries built with
`--profile speed`, three runs each on x86-64:

| | time | checksum |
| --- | --- | --- |
| WP16, `Result` as an arena pointer | 0.505 / 0.499 / 0.499 s | 887459712 |
| **WP17, packed `i64`** | **0.142 / 0.147 / 0.143 s** | 887459712 |

**3.5× faster**, same answer. That is the inlined path, which is the one the
package set out to make free.

### And what `sret` would have got

The compiler does not implement (c), so this last comparison is three
hand-written `.ll` files that mimic exactly what each lowering emits, with
`half` marked `noinline` so the call boundary is real (2 × 10^8 calls, x86-64,
`clang -O3`, three runs; the arena stub is `runtime.c`'s bump and the pointer
version carries the caller's `amrit_arena_mark` / `amrit_arena_release`):

| lowering | time | vs. WP16 |
| --- | --- | --- |
| (b/WP16) pointer to an arena struct | 1018 / 1033 / 1058 ms | — |
| (c) `sret` | 713 / 727 / 724 ms | 1.43× faster |
| **(a) packed `i64`** | **480 / 480 / 521 ms** | **2.09× faster** |

Identical checksums. So the win survives contact with the ABI even where the
call is not inlined away, and `sret` — the only other uniform option — gets
about half of it.

### Where the packing still costs something

`bench/result` is the same program as a benchmark, against C and Rust twins
that use the shape each language would use anyway — a two-word C struct (the
one `--emit-header` declares) and Rust's own `Result<i32, i32>`. AmritScript is
**1.46x behind C and 2.6x behind Rust** there, and the reason is not the
encoding but *how the two halves reach the optimiser*:

| the same program, written three ways | time |
| --- | --- |
| Rust `Result<i32, i32>` (two SSA values throughout) | 251 ms |
| C, an eight-byte struct clang coerces at the boundary | 444 ms |
| C, the word assembled by hand with `<< 32` and `\|` | 653 ms |
| **AmritScript** | **650 ms** |

The third row is the important one: C written the way `amritc` emits is
*exactly* our number, so this is not a code-generation defect on our side.
What separates the first two rows from the last two is whether the ok arm and
the error arm are ever separate SSA values. When they are, instcombine folds
`odd ? n : n >> 1` into a single variable shift; when they are halves of one
64-bit word, the `select` happens on the word and the simplification never
fires. Neither loop unrolling nor the checked-division blocks explain any of
it — both were ruled out by measurement.

**The obvious fix was tried and did not work.** Emitting the pack the way
clang does — store the tag and the payload into a two-word alloca, `load i64`
out of it, and the reverse on the way in — produces byte-identical assembly
to the `shl`/`or` form in *our* IR, on this program. So the shorter IR stays.
What would actually close the gap is not respelling the word but not forming
it at all inside a module: give an internal (non-exported) function a private
ABI of two scalars, the way rustc's `ScalarPair` does, and pack only where a
host can see. That needs `--strict-exports` to be more than advisory and is
the natural next step rather than something to bolt on here.

## 5. What is *not* by value

- **Large `Result`s**, by the rule in §1. They still travel as the arena
  pointer, and they now have a C spelling too: `--emit-header` declares the
  in-memory struct and the signature uses a pointer to it.
- **A `Result` in a field or an array element.** Those are the in-memory
  object, because they have to outlive the frame that built them. This is
  what makes a by-value *parameter* interesting rather than trivial: the
  callee unpacks the word into an object, and if any use of the parameter
  stores that pointer somewhere longer-lived — an object literal, `push` —
  the object has to be an arena bump rather than an entry-block `alloca`.
  `EscapeResult.stackParams` is that decision, and it is the same
  `localOutcome` walk WP6 already used for a local holding an allocation
  (`tests/cases/res_by_value_param` pins both halves in one golden).
- **The in-memory layout.** `%struct.amrit_result.<T>.<E>` is unchanged from
  WP16, and so is every construct that reads it. The packed word exists only
  at the return boundary: the callee packs where it would have allocated, and
  the caller unpacks into the entry-block object the rest of the lowering
  already understands. That is what kept the change to the emitter small
  enough to mirror into `self/` in one go.

## 6. Both compilers

Same rule as WP16 and for the same reason: stage0 is frozen as the bootstrap
seed and the differential oracle, not retired, and `tests/self/ir_oracle.js`
requires stage1 to compile every program in the corpus with no exemption
list. So this lands in `src/` and `self/` together — `src/types.ts` /
`self/types.ts` (the predicate and the return slot),
`src/codegen/emit/result.ts` / `self/emit_result.ts` (the pack and the
unpack), `src/codegen/emitter.ts`, `emit/statements.ts`, `emit/expressions.ts`
and `emit/classes.ts` / `self/emit.ts` and `self/emit_classes.ts` (the
`define`, the `declare`, the `ret`, the prologue and the two call sites), plus
`escape.ts` and `attributes.ts` on each side (the allocation moved to whichever
side unpacks, so the sites, the reported allocator call and the new
`stackParams` decision move with it) — and the oracle is what says the two
agree, byte for byte, before the bootstrap is allowed to reach its fixed
point: **274 of 274 programs, 941 modules, 1,286,495 lines of IR**, with
`IR(stage1) == IR(stage2)` and stage3 byte-identical to stage2 still holding
over the 43 modules of `self/`.

**AmritScript-0 did not grow.** Rule 5 of [wp14-selfhost.md](wp14-selfhost.md)
§6 — the subset `self/` is written in does not grow quietly — did not fire:
the packing is shifts, `zext`, `trunc`, `select` and one `bitcast`, all of
which `self/` could already express, and no construct entered the language
either. What this package adds to AmritScript is a *lowering* of a type that was
already there, which is why it ships no new surface syntax and its `reject_*`
case pins that the WP16 rules still hold on the new shape rather than a new
rule of its own.

`-g` and the interop sidecars are stage0's, as they have been since WP14 §4:
stage1 has no DWARF builder and no header generator, and the driver reports
those flags by name rather than ignoring them. (3) is therefore a stage0-only
change, and the IR oracle skips the `-g` corpus exactly as it did before.
