// WP51 stage 1: each context that stores a reference into a place (§2.3's
// store-context table): a constructor argument, a method argument, a return,
// a conditional, an interface field, an argument through a reference call.
type F = (x: i32) => i32
type G = (f: F) => i32

const plus1 = (x: i32): i32 => x + 1
const plus3 = (x: i32): i32 => x + 3

interface Holder {
  f: F
}

class Box {
  f: F
  constructor(f: F) {
    this.f = f
  }
  set(f: F): void {
    this.f = f
  }
}

const pick = (n: i32): F => (n > 0 ? plus3 : plus1)
const callOne = (f: F): i32 => f(1)

export const main = (): void => {
  const b = new Box(plus3)
  const first = b.f(1)
  b.set(plus1)
  const h: Holder = { f: pick(1) }
  const g: G = callOne
  console.log(`${first} ${b.f(1)} ${h.f(1)} ${g(plus3)} ${g(pick(0))}`)
}
