// WP51 stage 2, §4.1 case B through an argument: `hot` holds `keepIt`,
// which keeps `p`, beside `readX`, which does not, so passing an element
// to `apply` would put every `P` in the arena: refused (NL2736), naming
// the store that brought `keepIt` in.
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

const apply = (f: (p: P, k: Keep) => i32, p: P, k: Keep): i32 => f(p, k)

const run = (uses: Use[], k: Keep): i32 => {
  let sum = 0
  let i = 0
  while (i < 9) {
    const h = uses[i % 3]
    sum = sum + apply(h, new P(i), k)
    i = i + 1
  }
  return sum
}

export const main = (): void => {
  const k = new Keep()
  const hot: Use[] = [readX, readTwice, keepIt]
  const sum = run(hot, k)
  const once: Use = keepIt
  const e = keepIt(new P(5), k) + once(new P(6), k)
  console.log(`${sum} ${e} ${k.last.x}`)
}
