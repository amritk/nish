// Adapted from the Computer Language Benchmarks Game spectral-norm program
// (Node.js #1, contributed by Ian Osgood, modified by Isaac Gouy),
// https://benchmarksgame-team.pages.debian.net/benchmarksgame/.
// Copyright (c) 2004-2008 Brent Fulgham, 2005-2025 Isaac Gouy.
// Revised BSD licence; see bench/LICENSE-benchmarksgame.md.
// WP38 S3a, mat-vec form 4: mat-vec-checked.ts with every access in the
// kernel through `uncheckedGet` / `uncheckedSet`, to show what the checks still
// cost once #561 has proved them (docs/wp38-simd.md §2.3). The driver is the
// checked form's, byte for byte. Timed by bench/simd-s3a.mjs.
import { uncheckedGet, uncheckedSet, wrappingAdd, wrappingMul } from "nish:unsafe"

const N: i32 = 2000
const ROUNDS: i32 = 100

/** 1 / A's denominator, in i32 lanes that wrap: bench/spectral.ts's A(i, j). */
const a = (i: i32, j: i32): f64 => {
  const ij = wrappingAdd(i, j)
  return 1 / toF64(wrappingAdd(wrappingAdd(wrappingMul(ij, wrappingAdd(ij, 1)) / 2, i), 1))
}

/** av = A v over the first n of v, n a multiple of four. */
const mulAv = (v: f64[], av: f64[]): void => {
  const n = toI32(v.length)
  if (toI32(av.length) < n) {
    return
  }
  for (let i: i32 = 0; i < n; i++) {
    let s0: f64 = 0
    let s1: f64 = 0
    let s2: f64 = 0
    let s3: f64 = 0
    for (let j: i32 = 0; j + 3 < n; j = j + 4) {
      s0 = s0 + a(i, j) * uncheckedGet(v, j)
      s1 = s1 + a(i, j + 1) * uncheckedGet(v, j + 1)
      s2 = s2 + a(i, j + 2) * uncheckedGet(v, j + 2)
      s3 = s3 + a(i, j + 3) * uncheckedGet(v, j + 3)
    }
    uncheckedSet(av, i, s0 + s2 + (s1 + s3))
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
