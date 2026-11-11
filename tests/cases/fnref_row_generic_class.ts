// WP51 stage 1, §2.3 store row "a field of a generic class": `Pair<T>.f` is
// one place for every instantiation, so `u3`, stored only into a
// `Pair<string>`, is in the set a `Pair<i32>`'s call dispatches over, beside
// `u1`; `u2`, called through a local of its own, stays out of it.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

class Pair<T> {
  v: T
  f: F
  constructor(v: T, f: F) {
    this.v = v
    this.f = f
  }
}

export const main = (): void => {
  const other: F = u2
  const n = new Pair<i32>(1, u1)
  const s = new Pair<string>("s", u3)
  console.log(`${n.f(10)} ${s.f(10)} ${n.v} ${s.v} ${other(10)}`)
}
