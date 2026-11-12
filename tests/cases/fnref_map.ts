// WP51 stage 2: a function reference is a `Map` value. The map keeps its
// values in an array, an element place, so `get` and `values()` dispatch over
// the functions stored into it, with no indirect call.
type Op = (x: i32) => i32

const inc = (x: i32): i32 => x + 1
const twice = (x: i32): i32 => x * 2

export const main = (): void => {
  const m = new Map<string, Op>()
  m.set("inc", inc)
  m.set("twice", twice)
  const f = m.get("twice")
  if (f !== undefined) {
    console.log(`${f(5)}`)
  }
  let total = 0
  for (const g of m.values()) {
    total = total + g(10)
  }
  console.log(`${total} ${m.size} ${m.get("none") === undefined}`)
}
