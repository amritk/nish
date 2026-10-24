// Targets the rows rewrite: an element compound assignment at a computed index,
// an i64 `-0`, an i64 array length and f32 steps. Each translation must make
// Node print what the native program prints.
import { idiv, checkedAdd, toF64, convert } from "nish/runtime"
import type { i32, i64, f32, f64 } from "nish/runtime"
export const main = (): number => {
  const arr: i32[] = [10, 20, 31, 40]
  const i: i32 = 1
  arr[((i + 1) | 0)] = idiv(arr[((i + 1) | 0)], 2)
  arr[((i + 1) | 0)] = checkedAdd(arr[((i + 1) | 0)], 2147483000)
  console.log(`${arr[2]}`)
  const z: i64 = 0n
  const big: i64 = 5n
  console.log(`${checkedAdd(z, big)}`)
  const n: i64 = 2n
  const made = new Array<i32>(Number(BigInt.asIntN(64, n * 2n)))
  console.log(`${made.length}`)
  let x: f32 = Math.fround(16777216)
  x = Math.fround(x + 1)
  console.log(`${x}`)
  const old = [x, x = Math.fround(x - 1)][0]
  console.log(`${old} ${x}`)
  let y: f32 = Math.fround(16777216)
  const was = [y, y = Math.fround(y + 1)][0]
  console.log(`${was} ${y}`)
  const c: f32 = Math.fround(0.1)
  const d: f64 = convert(c, "f32", "f64")
  console.log(`${d}`)
  return 0
}
