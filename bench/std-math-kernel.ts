// The fdlibm-derived kernels of std/math.ts under an instruction count: `n`
// rounds that each take sinF64, cosF64 and tanF64 of small and very large
// arguments, atan2F64, hypotF64, expF64, logF64, powF64 and fmodF64 of 256
// values, and read 64 decimal strings with numberExact and parseFloatExact.
// It reaches the large-argument reduction, the pow and fmod word walks and
// the exact reader whose index and overflow sites the std/ ratchet counts,
// so a fix to one of them shows here as a count that holds or falls. It
// prints a sum of the answers.
import {
  atan2F64,
  cosF64,
  expF64,
  fmodF64,
  hypotF64,
  logF64,
  numberExact,
  parseFloatExact,
  powF64,
  sinF64,
  tanF64,
} from "nish/math"

/** How many distinct arguments each round takes. */
const VALUES: i32 = 256
/** How many strings each round reads. */
const TEXTS: i32 = 64

export const main = (): i32 => {
  const n: i32 = 240 // bench:n
  const xs: f64[] = []
  const texts: string[] = []
  for (let i: i32 = 0; i < VALUES; i++) {
    xs.push(toF64(i - 128) * 0.37 + 0.001)
  }
  for (let i: i32 = 0; i < TEXTS; i++) {
    texts.push(i % 2 === 0 ? `${i * 7919}.${1000 + i * 37}e${(i % 40) - 20}` : `0x${i * 4099}`)
  }
  let sum: f64 = 0
  for (let round: i32 = 0; round < n; round++) {
    for (let i: i32 = 0; i < xs.length; i++) {
      const x: f64 = xs[i]
      const big: f64 = x * 1e15 + toF64(round)
      sum += sinF64(x) + cosF64(x) + tanF64(x * 0.25)
      sum += sinF64(big) + cosF64(big)
      sum += atan2F64(x, xs[(i * 7) % VALUES]) + hypotF64(x, toF64(round))
      sum += expF64(x * 0.5) + logF64(x * x + 1)
      sum += powF64(x * x + 0.5, x * 0.1) + fmodF64(big, x)
    }
    for (let i: i32 = 0; i < texts.length; i++) {
      sum += numberExact(texts[i]) * 1e-12 + parseFloatExact(texts[i]) * 1e-12
    }
  }
  console.log(`${sum}`)
  return 0
}
