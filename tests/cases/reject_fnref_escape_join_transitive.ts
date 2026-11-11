// WP51 §2.2, §4.1 case B: `keepIt` keeps `p` only through `remember`, which
// pushes it into `k`. The refusal reads the same fact the dispatcher's join
// does, so a member that keeps an argument through another function is a
// keeper too, and the set of it and `readX` is refused: NL2736.
class P {
  x: i32 = 0
  constructor(x: i32) {
    this.x = x
  }
}

class Keep {
  items: P[]
  constructor() {
    this.items = []
  }
}

type Use = (p: P, k: Keep) => i32

const remember = (k: Keep, p: P): void => {
  k.items.push(p)
}

const readX = (p: P, k: Keep): i32 => p.x
const keepIt = (p: P, k: Keep): i32 => {
  remember(k, p)
  return p.x
}

export const main = (): void => {
  const k = new Keep()
  const uses: Use[] = [readX, keepIt]
  let sum = 0
  let i = 0
  while (i < 4) {
    sum = sum + uses[i % 2](new P(i), k)
    i = i + 1
  }
  console.log(`${sum}`)
}
