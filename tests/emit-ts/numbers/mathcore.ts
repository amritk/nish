// `Math.sign` on an i64 or u64 goes through the core's `signI64`, where Math
// refuses a BigInt; `min`, `max` and `round` on an f64 stay Math's own, -0
// and the half-way round included.
export const main = (): number => {
  const a: i64 = -9007199254740993
  const big: u64 = 4294967296
  const b: u64 = big * big - 1
  const z: i64 = 0
  const one: f64 = 1.0
  const n: f64 = -0.0
  const p: f64 = 0.0
  const h: f64 = 2.5
  const m: f64 = -1.5
  const q: f64 = -0.4
  console.log(`${Math.sign(a)} ${Math.sign(b)} ${Math.sign(z)}`)
  console.log(`${one / Math.min(p, n)} ${one / Math.max(n, p)} ${Math.min(h, m)} ${Math.max(h, m)}`)
  console.log(`${Math.round(h)} ${Math.round(-h)} ${Math.round(q)} ${one / Math.round(q)}`)
  return 0
}
