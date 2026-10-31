const apply = (f: (x: i32) => i32, x: i32): i32 => f(x)

export function main(): i32 {
  let k = 10
  k = k * 2
  const kNow = k
  const r = apply((x: i32): i32 => x + kNow, 1)
  console.log(r)
  return 0
}
