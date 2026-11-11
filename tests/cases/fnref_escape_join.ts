// WP51 stage 1: the escape join over a set (§2.2, §4). The `Use[]` element
// place's members all leave `p` alone, so its dispatcher is `readonly
// nocapture` in `p` like each of them and `p` stays on the stack; the field
// `Slot.use`'s members both store `p`, so a direct call of either costs the
// same and the set is admitted. A set mixing the two is NL2736. Every array of
// one element type shares its place, so the second set is in a field.
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

class Slot {
  use: Use
  constructor(use: Use) {
    this.use = use
  }
}

const readX = (p: P, k: Keep): i32 => p.x
const readTwice = (p: P, k: Keep): i32 => p.x * 2
const keepIt = (p: P, k: Keep): i32 => {
  k.last = p
  return p.x
}
const keepPlus = (p: P, k: Keep): i32 => {
  k.last = p
  return p.x + 1
}

export const main = (): void => {
  const k = new Keep()
  const local: Use[] = [readX, readTwice]
  const slot = new Slot(keepIt)
  let sum = 0
  let i = 0
  while (i < 4) {
    sum = sum + local[i % 2](new P(i), k)
    if (i === 2) {
      slot.use = keepPlus
    }
    sum = sum + slot.use(new P(i), k)
    i = i + 1
  }
  console.log(`${sum} ${k.last.x}`)
}
