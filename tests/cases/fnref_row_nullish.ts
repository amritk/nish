// WP51 stage 1, §2.3 value rule for `x ?? y`: the default `u1` and the
// field read `h?.f` both reach the local `g`, so its set is {u1, u3}; `u2`,
// called through a local of its own, stays out of it.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

class Holder {
  f: F
  constructor(f: F) {
    this.f = f
  }
}

const find = (n: i32): Holder | null => (n > 0 ? new Holder(u3) : null)

export const main = (): void => {
  const other: F = u2
  const g: F = find(1)?.f ?? u1
  const d: F = find(0)?.f ?? u1
  console.log(`${g(10)} ${d(10)} ${other(10)}`)
}
