// The Math builtins whose lowering has a choice to make (docs/LANGUAGE.md,
// "Builtins"), one kernel each: `Math.atan2`, `tan`, `hypot`, `sign` on an
// `i32` and on an `f64`, `imul`, `round`, `min`, `max`, and `f32ToBits`.
// Compile with --number-mode f64.
//
//   math [kernel]
//
// With no argument every kernel runs and prints `<kernel> <checksum>`; naming a
// kernel runs it alone, so that the harness times each in a process of its own.
//
// Each kernel walks a table of 4096 inputs, so its input changes every
// iteration, and folds every result into an FNV-style hash, so nothing can be
// hoisted or dropped. One input in sixteen is a special value (NaN, ±0, ±0.5,
// ±2.5, ±Infinity, the largest double below 0.5), the cases where JavaScript's
// `round`, `min`, `max` and `sign` differ from the C library's. A float result
// is folded as the bits of its f32 rounding, with every NaN folded as one
// value: a NaN's payload is not part of what JavaScript promises, and an f64
// that the twins' libm routines round differently in its last bit almost never
// rounds differently as an f32.
//
// The twins, math.c, math.go and math.rs, build the same tables with the same
// xorshift, run the same loops and print the same lines.
const SIZE: i32 = 4096

/** The special input at every sixteenth slot, in turn. */
const special = (k: i32): number => {
  const z = 0
  if (k === 0) {
    return z / z
  }
  if (k === 1) {
    return z
  }
  if (k === 2) {
    return -z
  }
  if (k === 3) {
    return 0.5
  }
  if (k === 4) {
    return -0.5
  }
  if (k === 5) {
    return 2.5
  }
  if (k === 6) {
    return -2.5
  }
  if (k === 7) {
    return 1 / z
  }
  if (k === 8) {
    return -1 / z
  }
  if (k === 9) {
    return 0.49999999999999994
  }
  if (k === 10) {
    return -0.49999999999999994
  }
  if (k === 11) {
    return 4503599627370497
  }
  if (k === 12) {
    return 1e300
  }
  if (k === 13) {
    return -1e-300
  }
  if (k === 14) {
    return 3
  }
  return -7
}

/** `b` folded into `h`: xor, then the FNV prime, wrapping. */
const mix = (h: i32, b: i32): i32 => Math.imul(h ^ b, 16777619)

/** A float result as an i32: the bits of its f32 rounding, one value for every NaN. */
// biome-ignore lint/suspicious/noSelfCompare: NaN is the only value that is not itself; Nish has no Number.isNaN
const bits = (r: number): i32 => (r !== r ? 2143289344 : f32ToBits(toF32(r)))

export const main = (): i32 => {
  const N: i32 = 20000000 // bench:n
  const only = process.argv.length > 1 ? process.argv[1] : ""
  const xs: number[] = []
  const is: i32[] = []
  let s: i32 = 1013904223
  for (let j: i32 = 0; j < SIZE; j++) {
    s = s ^ (s << 13)
    s = s ^ (s >>> 17)
    s = s ^ (s << 5)
    is.push(s)
    xs.push((j & 15) === 0 ? special((j >> 4) & 15) : toF64(s) / 65536)
  }

  if (only === "" || only === "atan2") {
    let h: i32 = -2128831035
    for (let i: i32 = 0; i < N; i++) {
      const j: i32 = i & 4095
      const k: i32 = (i + 1237) & 4095
      h = mix(h, bits(Math.atan2(xs[j], xs[k])))
    }
    console.log(`atan2 ${h}`)
  }
  if (only === "" || only === "tan") {
    let h: i32 = -2128831035
    for (let i: i32 = 0; i < N; i++) {
      const j: i32 = i & 4095
      h = mix(h, bits(Math.tan(xs[j])))
    }
    console.log(`tan ${h}`)
  }
  if (only === "" || only === "hypot") {
    let h: i32 = -2128831035
    for (let i: i32 = 0; i < N; i++) {
      const j: i32 = i & 4095
      const k: i32 = (i + 1237) & 4095
      h = mix(h, bits(Math.hypot(xs[j], xs[k])))
    }
    console.log(`hypot ${h}`)
  }
  if (only === "" || only === "sign-int") {
    let h: i32 = -2128831035
    for (let i: i32 = 0; i < 8 * N; i++) {
      const j: i32 = i & 4095
      h = mix(h, Math.sign(is[j]))
    }
    console.log(`sign-int ${h}`)
  }
  if (only === "" || only === "sign-float") {
    let h: i32 = -2128831035
    for (let i: i32 = 0; i < 8 * N; i++) {
      const j: i32 = i & 4095
      h = mix(h, bits(Math.sign(xs[j])))
    }
    console.log(`sign-float ${h}`)
  }
  if (only === "" || only === "imul") {
    let h: i32 = -2128831035
    for (let i: i32 = 0; i < 8 * N; i++) {
      const j: i32 = i & 4095
      const k: i32 = (i + 1237) & 4095
      h = mix(h, Math.imul(is[j], is[k]))
    }
    console.log(`imul ${h}`)
  }
  if (only === "" || only === "round") {
    let h: i32 = -2128831035
    for (let i: i32 = 0; i < 8 * N; i++) {
      const j: i32 = i & 4095
      h = mix(h, bits(Math.round(xs[j])))
    }
    console.log(`round ${h}`)
  }
  if (only === "" || only === "min") {
    let h: i32 = -2128831035
    for (let i: i32 = 0; i < 8 * N; i++) {
      const j: i32 = i & 4095
      const k: i32 = (i + 1237) & 4095
      h = mix(h, bits(Math.min(xs[j], xs[k])))
    }
    console.log(`min ${h}`)
  }
  if (only === "" || only === "max") {
    let h: i32 = -2128831035
    for (let i: i32 = 0; i < 8 * N; i++) {
      const j: i32 = i & 4095
      const k: i32 = (i + 1237) & 4095
      h = mix(h, bits(Math.max(xs[j], xs[k])))
    }
    console.log(`max ${h}`)
  }
  if (only === "" || only === "f32-to-bits") {
    let h: i32 = -2128831035
    for (let i: i32 = 0; i < 8 * N; i++) {
      const j: i32 = i & 4095
      h = mix(h, f32ToBits(toF32(xs[j])))
    }
    console.log(`f32-to-bits ${h}`)
  }
  return 0
}
