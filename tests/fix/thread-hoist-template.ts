import { Channel, scope } from "nish/threads"

const measure = (ch: Channel<string>): i32 => {
  let sum = 0
  for (const x of ch) {
    sum = sum + x.length
  }
  return sum
}

export function main(): i32 {
  const out = new Array<i32>(1)
  const ch = new Channel<string>()
  {
    using s = scope()
    s.spawn((c: Channel<string>): void => {
      c.send(`one
    two`)
    }, ch)
    s.spawn(measure, ch, out, 0)
  }
  console.log(out[0])
  return 0
}
