# Vectors (SIMD)

A vector holds sixteen bytes of numbers side by side: sixteen `u8`s, eight
`u16`s, four `i32`s or `u32`s or `f32`s, or two `f64`s. The processor can move
a whole vector in one instruction, so a loop that loads, stores and shuffles
vectors does in one step what would otherwise take four or sixteen. The six
types and their functions come from the built-in module `nish:simd`. The rules
are in the reference under [`nish:simd`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#nishsimd-sixteen-byte-vectors)
and [its lane operations](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#nishsimd-lane-operations-and-masks).

## Making a vector

Import the type you need. Its name is also its constructor, which takes one
value per lane, lane 0 first. `splat…` puts one value in every lane:

```ts nish:ok
import { i32x4, splatF64x2, extract } from "nish:simd";

export const main = (): i32 => {
  const v = i32x4(10, 20, 30, 40);
  const half = splatF64x2(0.5);
  console.log(extract(v, 2));
  console.log(extract(half, 1));
  return 0;
};
```

That prints `30` and `0.5`.

| Type | Lanes | Constructor | `splat…` | `load…` |
| --- | --- | --- | --- | --- |
| `u8x16` | sixteen `u8` | `u8x16(a0, …, a15)` | `splatU8x16(x)` | `loadU8x16(xs, i)` |
| `u16x8` | eight `u16` | `u16x8(a0, …, a7)` | `splatU16x8(x)` | `loadU16x8(xs, i)` |
| `i32x4` | four `i32` | `i32x4(a, b, c, d)` | `splatI32x4(x)` | `loadI32x4(xs, i)` |
| `u32x4` | four `u32` | `u32x4(a, b, c, d)` | `splatU32x4(x)` | `loadU32x4(xs, i)` |
| `f32x4` | four `f32` | `f32x4(a, b, c, d)` | `splatF32x4(x)` | `loadF32x4(xs, i)` |
| `f64x2` | two `f64` | `f64x2(a, b)` | `splatF64x2(x)` | `loadF64x2(xs, i)` |

## Loading and storing

`loadI32x4(xs, i)` reads `xs[i]` to `xs[i + 3]` into a vector, and
`store(v, xs, i)` writes a vector's lanes back to the same places. The array's
elements must be the lane type: an `i32x4` comes from an `i32[]`, a `u8x16`
from a `u8[]`.

The index is checked once for the whole vector, and if any of
its lanes would fall outside the array the program stops with the
`index out of range: … >= len` message an `xs[i]` gives. It names `i` when
`i` itself is out of range, and otherwise the last lane, `i + N - 1`, where
`N` is the lane count: `loadI32x4(xs, 2)` on a five-element array stops with
`index out of range: 5 >= 5`.

A loop guard that already keeps every lane in range removes the check, as it
does for `xs[i]`: under `while (i <= n - 4)`, with `n` the array's length and
`i` counting up from 0, `loadI32x4(xs, i)` compiles to the load alone. A
guard one lane short, `i <= n - 3`, proves nothing, so that load keeps its
check.

```ts nish:ok
import { loadU8x16, store } from "nish:simd";

export const main = (): i32 => {
  const src: u8[] = [];
  for (let i = 0; i < 32; i++) {
    src.push(toU8(i));
  }
  const dst: u8[] = [];
  for (let i = 0; i < 32; i++) {
    dst.push(0);
  }
  for (let i = 0; i + 16 <= src.length; i += 16) {
    store(loadU8x16(src, i), dst, i);
  }
  console.log(dst[31]);
  return 0;
};
```

## Reading and replacing a lane

`extract(v, k)` reads lane `k`, and `replace(v, k, x)` gives a new vector that
is `v` with lane `k` set to `x`; `v` itself does not change. The lane number
has to be a number written in the code, from 0 to one less than the lane
count, so the compiler can check it:

```ts nish:err NL2580
import { i32x4, extract } from "nish:simd";

export const main = (): i32 => {
  const k = 1;
  console.log(extract(i32x4(1, 2, 3, 4), k));
  return 0;
};
```

## What a vector can do

A vector is a value, like a number. You can keep one in a variable, a class
field or an array, pass it to a function and return it. It has no operators:
`+`, `===`, `<` and the others are refused, and so is printing one directly —
use the functions below, and read the lanes with `extract`.

```ts nish:err NL2231
import { i32x4 } from "nish:simd";

export const main = (): i32 => {
  const a = i32x4(1, 2, 3, 4);
  const b = a + a;
  return 0;
};
```

A vector cannot be a `Map` key, cannot be `null`, and cannot appear in the
signature of a function that C or JavaScript calls: `--emit-header`,
`--emit-napi` and `--emit-dts` leave out a function whose parameter or result
holds a vector anywhere — a vector, an array of them, a `Result` with a vector
arm — and say why. In a C header, a class that holds a vector anywhere, even
through another class, is declared without its fields, and a function taking a
pointer to one keeps it as an opaque `struct Name *`.

The same program prints the same thing natively, under `--profile wasi` and
under Node, where each vector is a typed array that is never changed after it
is made.

## Working on every lane at once

Each operation is a function that works lane by lane: lane 0 of the answer
comes from lane 0 of each operand, and so on. Float vectors use `add`, `sub`,
`mul`, `div`, `neg`, `abs` and `sqrt`. Integer vectors use `addWrapping`,
`subWrapping` and `mulWrapping`, which wrap around when a lane overflows
instead of stopping the program, and the name says so. `min` and `max` take
any vector, and `and`, `or`, `xor` and `not` take integer vectors. `sum` adds
the lanes of a `u8x16`, `u16x8` or float vector; `sumWrapping` adds the lanes
of an `i32x4` or `u32x4`, wrapping.

```ts nish:ok
import { f32x4, i32x4, splatF32x4, mul, add, addWrapping, sum, sumWrapping } from "nish:simd";

export const main = (): i32 => {
  const v = add(mul(f32x4(1, 2, 3, 4), splatF32x4(2)), splatF32x4(0.5));
  console.log(sum(v));
  console.log(sumWrapping(addWrapping(i32x4(1, 2, 3, 4), i32x4(10, 20, 30, 40))));
  return 0;
};
```

That prints `22` and `110`. Both operands of an operation are the same type:
an `i32x4` and a `u32x4` are refused together, and `asU32x4` and the other
`as…` functions read the same sixteen bytes as different lanes.

## Shifting and rotating

`shl(v, n)` shifts every lane left by `n` bits and `shr(v, n)` shifts it right;
`rotl` and `rotr` rotate, so the bits shifted out at one end come back in at
the other. They take a `u8x16`, `u16x8`, `i32x4` or `u32x4`. `shr` fills with
zeros on the unsigned types and with copies of the sign bit on `i32x4`. The
count is a number written in the code and smaller than the lane's width in
bits (8, 16 or 32), so each is a single instruction. Rotates are what
ChaCha20, SHA-256 and similar code are made of:

```ts nish:ok
import { u32x4, addWrapping, xor, rotl, extract } from "nish:simd";

export const main = (): i32 => {
  // Four ChaCha20 states at once: lane k belongs to block k.
  const a = addWrapping(u32x4(1, 2, 3, 4), u32x4(0x10000, 0x20000, 0x30000, 0x40000));
  const d = rotl(xor(u32x4(0, 0, 0, 0), a), 16);
  console.log(extract(d, 0));
  return 0;
};
```

That prints `65537`. A count of 32 or more on a 32-bit lane, or a count held
in a variable, is refused:

```ts nish:err NL2631
import { u32x4, rotl, extract } from "nish:simd";

export const main = (): i32 => {
  console.log(extract(rotl(u32x4(1, 2, 3, 4), 32), 0));
  return 0;
};
```

## Comparing lanes

`eq`, `ne`, `lt`, `le`, `gt` and `ge` compare two vectors lane by lane and
answer a mask: `mask32x4` for four 32-bit lanes, `mask8x16` for sixteen bytes,
and so on. `any(m)` and `all(m)` ask whether some or every lane passed,
`bitmask(m)` gives an `i32` whose bit `k` is lane `k`, and `select(m, a, b)`
takes each lane from `a` where the mask is set and from `b` where it is not.

```ts nish:ok
import { u8x16, splatU8x16, eq, any, bitmask } from "nish:simd";

export const main = (): i32 => {
  const block = u8x16(104, 105, 32, 116, 104, 101, 114, 101, 32, 33, 0, 0, 0, 0, 0, 0);
  const spaces = eq(block, splatU8x16(32));
  if (any(spaces)) {
    console.log(bitmask(spaces));
  }
  return 0;
};
```

That prints `260`: bits 2 and 8, where the spaces are. A mask is only ever a
variable, a parameter or what a function returns. It cannot be stored in a
field or an array; store its `bitmask`, or the vectors it selects, instead.
