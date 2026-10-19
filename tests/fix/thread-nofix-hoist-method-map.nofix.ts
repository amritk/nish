import { Channel, parallelMap } from "nish/threads"

class Runner {
  runBody(): i32 {
    const xs: i32[] = [1, 2, 3]
    const ys = parallelMap(xs, (x: i32): i32 => {
      const ch = new Channel<i32>()
      ch.send(x)
      return x * 2
    })
    return ys[0] + ys[1] + ys[2]
  }
}

export function main(): i32 {
  console.log(new Runner().runBody())
  return 0
}
