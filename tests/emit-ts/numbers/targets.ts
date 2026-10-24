// Targets the rows rewrite: an element compound assignment at a computed index,
// an i64 `-0`, an i64 array length and f32 steps. Each translation must make
// Node print what the native program prints.
export const main = (): number => {
  const arr: i32[] = [10, 20, 31, 40]
  const i: i32 = 1
  arr[i + 1] /= 2
  arr[i + 1] += 2147483000
  console.log(`${arr[2]}`)
  const z: i64 = -0
  const big: i64 = 5
  console.log(`${z + big}`)
  const n: i64 = 2
  const made = new Array<i32>(n * 2)
  console.log(`${made.length}`)
  let x: f32 = 16777216
  x++
  console.log(`${x}`)
  const old = x--
  console.log(`${old} ${x}`)
  let y: f32 = 16777216
  const was = y++
  console.log(`${was} ${y}`)
  const c: f32 = 0.1
  const d: f64 = toF64(c)
  console.log(`${d}`)
  return 0
}
