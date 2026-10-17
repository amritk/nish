import { scope } from "nish/threads"

export function main(): i32 {
  let k = 3
  k = k + 1
  const out = new Array<i32>(6)
  for (let i = 0; i < 3; i++) {
    using s = scope()
    const kNow = k
    s.spawn((n: i32): i32 => n * kNow, i, out, i)
    const kNow2 = k
    s.spawn((n: i32): i32 => n + kNow2, i, out, i + 3)
  }
  console.log(out[0] + out[1] + out[2] + out[3] + out[4] + out[5])
  return 0
}
