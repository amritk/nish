# Vectors (SIMD)

A vector holds sixteen bytes of numbers side by side: sixteen `u8`s, eight
`u16`s, four `i32`s or `u32`s or `f32`s, or two `f64`s. The processor can move
a whole vector in one instruction, so a loop that loads, stores and shuffles
vectors does in one step what would otherwise take four or sixteen. The six
types and their functions come from the built-in module `nish:simd`. The rules
are in the reference under [`nish:simd`](../../LANGUAGE.md#nishsimd-sixteen-byte-vectors).

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
from a `u8[]`. The index is checked once for the whole vector, and if any of
its lanes would fall outside the array the program stops with the same
`index out of range: i >= len` message an `xs[i]` gives:

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
field or an array, pass it to a function and return it. It has no operators
in this version: `+`, `===`, `<` and the others are refused, and so is
printing one directly — read the lanes with `extract`. A vector cannot be a
`Map` key, cannot be `null`, and cannot appear in the signature of a function
that C or JavaScript calls: `--emit-header`, `--emit-napi` and `--emit-dts`
leave out a function with a vector, or an array of vectors, as a parameter or
result, and say why. In a C header, a class with a vector field is declared
without its fields.

The same program prints the same thing natively, under `--profile wasi` and
under Node, where each vector is a typed array that is never changed after it
is made.
