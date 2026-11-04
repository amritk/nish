// Adapted from the Computer Language Benchmarks Game spectral-norm program
// (Node.js #1, contributed by Ian Osgood, modified by Isaac Gouy),
// https://benchmarksgame-team.pages.debian.net/benchmarksgame/.
// Copyright (c) 2004-2008 Brent Fulgham, 2005-2025 Isaac Gouy.
// Revised BSD licence; see bench/LICENSE-benchmarksgame.md.
// WP38 S3, mat-vec form 5: mat-vec-vector.c's kernel written with nish:simd,
// the form S3's bar times against form 3 (docs/wp38-simd.md §2.3, §7). Four
// i32 indices per i32x4 step and two f64x2 accumulators, lanes 0 and 1 of the
// first holding j = 0 and 1 mod 4 and the second's 2 and 3, so every form adds
// in one order and prints one checksum. Two differences from the C form, both
// forced by what nish:simd leaves out (§3.2): the halving is `shr` by 1, which
// is C's `/ 2` here because ij * (ij + 1) is never negative below N = 2000,
// and each i32 lane reaches f64 through `extract` and `toF64`, there being no
// lane conversion. Timed by bench/simd-s3a.mjs.
import {
  add,
  addWrapping,
  div,
  extract,
  f64x2,
  i32x4,
  loadF64x2,
  mul,
  mulWrapping,
  shr,
  splatF64x2,
  splatI32x4,
  sum,
} from "nish:simd"

const N: i32 = 2000
const ROUNDS: i32 = 100

/** av = A v over the first n of v, n a multiple of four. */
const mulAv = (v: f64[], av: f64[]): void => {
  const n = toI32(v.length)
  if (toI32(av.length) < n) {
    return
  }
  const one = splatI32x4(1)
  const four = splatI32x4(4)
  const ones = splatF64x2(1)
  for (let i: i32 = 0; i < n; i++) {
    const iv = splatI32x4(i)
    let jv = i32x4(0, 1, 2, 3)
    let s01 = splatF64x2(0)
    let s23 = splatF64x2(0)
    for (let j: i32 = 0; j + 3 < n; j = j + 4) {
      const ij = addWrapping(iv, jv)
      const d = addWrapping(addWrapping(shr(mulWrapping(ij, addWrapping(ij, one)), 1), iv), one)
      const d01 = f64x2(toF64(extract(d, 0)), toF64(extract(d, 1)))
      const d23 = f64x2(toF64(extract(d, 2)), toF64(extract(d, 3)))
      s01 = add(s01, mul(div(ones, d01), loadF64x2(v, j)))
      s23 = add(s23, mul(div(ones, d23), loadF64x2(v, j + 2)))
      jv = addWrapping(jv, four)
    }
    av[i] = sum(add(s01, s23))
  }
}

export const main = (): i32 => {
  const v = new Array<f64>(N)
  const av = new Array<f64>(N)
  for (let i: i32 = 0; i < toI32(v.length); i++) {
    v[i] = 1
  }
  for (let i: i32 = 0; i < toI32(av.length); i++) {
    av[i] = 0
  }
  let checksum: i64 = 0
  for (let r: i32 = 0; r < ROUNDS; r++) {
    // One more element moves before every product, so no round repeats one.
    v[(r * 7) % N] = v[(r * 7) % N] + 0.5
    mulAv(v, av)
    let total: f64 = 0
    for (let i: i32 = 0; i < toI32(av.length); i++) {
      total = total + av[i]
    }
    checksum = (checksum * 31 + toI64(total * 1000)) % 1000003
  }
  console.log(checksum)
  return 0
}
