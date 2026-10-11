import { Channel, scope } from "nish/threads"

const produce = (ch: Channel<i32>): i32 => {
  ch.send(20)
  ch.send(22)
  return 2
}

export const total = (): i32 => {
  const sent: i32[] = [0]
  const ch = new Channel<i32>()
  {
    using s = scope()
    s.spawn(produce, ch, sent, 0)
  }
  let sum: i32 = 0
  for (const x of ch) {
    sum = sum + x
  }
  return sum + sent[0]
}
