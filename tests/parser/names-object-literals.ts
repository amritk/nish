// The readings WP33 R1 keeps beside the object-literal forms it now reads for
// Phase 0 to refuse: a computed key `{ [k]: 1 }` and spread `{ ...a }`, and a
// computed member name in a class or an interface (NL1041, NL1061). Each opens
// at a `[` or a `...` where a key stands, which was a syntax error before.
// None of those is in this file, which holds the programs beside them that
// already compiled, and every one compiles as it did, to the same bytes: the
// words as keys and shorthands, an array literal as a value, a `[` at the
// start of a line that continues the expression before it — an element
// access, as TypeScript reads it — and one after a `;` that opens a statement.
interface Pair {
  a: i32
  b: i32
}

interface Words {
  get: i32
  set: i32
  async: i32
  static: i32
}

const words = (get: i32, set: i32): Words => {
  const async: i32 = 3
  return { get, set, async, static: 4 }
}

export const main = (): i32 => {
  const xs: i32[] = [5, 6]
  const pairs: Pair[] = [
    { a: 1, b: 2 },
    { a: [7, 8][0], b: xs[1] },
  ]
  const first: Pair = pairs
  [0]
  const second: Pair = { a: xs[0], b: 2, }
  ;[xs[0], xs[1]].length
  const w: Words = words(1, 2)
  console.log(`${first.a} ${pairs[1].a} ${second.a} ${w.get + w.set + w.async + w.static}`)
  return 0
}
