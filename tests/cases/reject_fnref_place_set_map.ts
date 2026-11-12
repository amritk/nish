// WP51 stage 2, §4.1 case B through a `Map` value: `set` stores `keepIt`
// among the map's values, so the call through `get`'s result dispatches
// over a set that holds a member that keeps `p` and members that do not,
// and a call that would put each `P` in the arena is refused (NL2736)
// with the store that put `keepIt` there.
class P {
  x: i32 = 0
  constructor(x: i32) {
    this.x = x
  }
}

class Keep {
  last: P
  constructor() {
    this.last = new P(0)
  }
}

type Use = (p: P, k: Keep) => i32

const readX = (p: P, k: Keep): i32 => p.x
const readTwice = (p: P, k: Keep): i32 => p.x * 2
const readThrice = (p: P, k: Keep): i32 => p.x * 3
const keepIt = (p: P, k: Keep): i32 => {
  k.last = p
  return p.x
}

const run = (uses: Map<i32, Use>, k: Keep): i32 => {
  let sum = 0
  let i = 0
  while (i < 9) {
    const h = uses.get(i % 3)
    if (h !== undefined) {
      sum = sum + h(new P(i), k)
    }
    i = i + 1
  }
  return sum
}

export const main = (): void => {
  const k = new Keep()
  const hot = new Map<i32, Use>()
  hot.set(0, readX)
  hot.set(1, readTwice)
  hot.set(2, readThrice)
  hot.set(3, keepIt)
  const sum = run(hot, k)
  const once: Use = keepIt
  const e = keepIt(new P(5), k) + once(new P(6), k)
  console.log(`${sum} ${e} ${k.last.x}`)
}
