import { Channel, scope } from "nish/threads"

const receive = (ch: Channel<i32>): i32 => {
  let sum = 0
  for (const x of ch) {
    sum = sum + x
  }
  return sum
}

const mainTask = (c: Channel<i32>): void => {
  c.send(1)
  c.send(2)
}

export function main(): i32 {
  const out = new Array<i32>(1)
  const ch = new Channel<i32>()
  {
    using s = scope()
    s.spawn(mainTask, ch)
    s.spawn(receive, ch, out, 0)
  }
  console.log(out[0])
  return 0
}
