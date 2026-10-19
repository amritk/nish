import { Channel, scope } from "nish/threads"

const receive = (ch: Channel<i32>): i32 => {
  let sum = 0
  for (const x of ch) {
    sum = sum + x
  }
  return sum
}

export function main(): i32 {
  const out = new Array<i32>(1)
  const ch = new Channel<i32>()
  const step = 2
  {
    using s = scope()
    s.spawn((c: Channel<i32>): void => {
      c.send(step)
    }, ch)
    s.spawn(receive, ch, out, 0)
  }
  console.log(out[0])
  return 0
}
