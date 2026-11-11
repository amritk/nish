// WP51 stage 1, §2.3 store row "a field initializer": a class field's
// initializer is a literal, so a function name there is refused before the
// reference pass runs, and the row stores nothing in stage 1.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

class Box {
  f: F = u3
  set(f: F): void {
    this.f = f
  }
}

export const main = (): void => {
  const other: F = u2
  const b = new Box()
  const first = b.f(10)
  b.set(u1)
  console.log(`${first} ${b.f(10)} ${other(10)}`)
}
