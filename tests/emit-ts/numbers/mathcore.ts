// `Math.sign` on an i64 or u64 goes through the core's `signI64`, where Math
// refuses a BigInt; `min`, `max` and `round` on an f64 stay Math's own, -0
// and the half-way round included.
export const main = (): number => {
  const a: i64 = -9007199254740993
  const b: u64 = 18446744073709551615
  const z: i64 = 0
  const n: f64 = -0.0
  const p: f64 = 0.0
  console.log(`${Math.sign(a)} ${Math.sign(b)} ${Math.sign(z)}`)
  console.log(`${1 / Math.min(p, n)} ${1 / Math.max(n, p)} ${Math.min(2.5, -1.5)} ${Math.max(2.5, -1.5)}`)
  console.log(`${Math.round(2.5)} ${Math.round(-2.5)} ${Math.round(-0.4)} ${1 / Math.round(-0.4)}`)
  return 0
}
