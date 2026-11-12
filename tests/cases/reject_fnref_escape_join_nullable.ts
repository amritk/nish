// WP51 stage 2, §4.1 case B through a nullable element: `hot[2] = keepIt`
// puts a member that keeps `p` in the set beside members that do not, so
// the call under `h !== null` is refused (NL2736), naming that store.
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

const run = (uses: (Use | null)[], k: Keep): i32 => {
  let sum = 0
  let i = 0
  while (i < 9) {
    const h = uses[i % 3]
    if (h !== null) {
      sum = sum + h(new P(i), k)
    }
    i = i + 1
  }
  return sum
}

export const main = (): void => {
  const k = new Keep()
  const hot = new Array<Use | null>(4)
  hot[0] = readX
  hot[1] = readTwice
  hot[2] = keepIt
  const sum = run(hot, k)
  const once: Use = keepIt
  const e = keepIt(new P(5), k) + once(new P(6), k)
  console.log(`${sum} ${e} ${k.last.x}`)
}
