// WP51 §2.2, §4.1 case B: one set holds a member that keeps `p` and members
// that do not, so the dispatcher's join would allocate every `p` in the
// arena, the members that leave it alone included: NL2730.
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
const keepIt = (p: P, k: Keep): i32 => {
  k.last = p
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
