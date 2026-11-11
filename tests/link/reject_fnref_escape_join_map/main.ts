// WP51 stage 1: a reference read out of a `Map` may be any function of its
// signature, so a call through it joins `keepIt`, which keeps `p`, with
// `readX`, which does not: the escape join is refused, not decided on the
// narrower set the `??` default alone would give.
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

const step = (i: i32, k: Keep, u: Use): void => {
  const p = new P(i)
  u(p, k)
}

export const main = (): void => {
  const k = new Keep()
  const m = new Map<string, Use>()
  m.set("keep", keepIt)
  const u = m.get("keep") ?? readX
  step(42, k, u)
  console.log(`${k.last.x}`)
}
