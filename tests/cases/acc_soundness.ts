// Shapes the proof beside src/emit-accumulate.ts covers, each pinned by its
// output: arguments that trade places through the header's phis, a split
// inside a split, two steps of which only one ever enters the header cold,
// and a nullable class parameter passed on the cold call. Every function is
// one loop; acc_soundness.out is what the recursion prints.
//
// With a case number as the argument that case runs first, and must exit 1
// with "attempt to divide by zero" and print nothing, as the recursion does
// (tests/run.js runs each). In both, the steps above the panic have added past
// MAX, an overflow the recursion never reaches:
//   0  the base divides by zero
//   1  the third step's `X` divides by zero
const BIG: i32 = 1073741824

/** `a` and `b` trade places at every step; the base is the last `a`, times 1000. */
const swap = (a: i32, b: i32, n: i32): i32 => {
  if (n === 0) {
    return a * 1000
  }
  return a + swap(b, a, n - 1)
}

const baseDiv = (n: i32, d: i32): i32 => {
  if (n === 0) {
    return 10 % d
  }
  return BIG + baseDiv(n - 1, d)
}

const stepDiv = (n: i32, d: i32): i32 => {
  if (n === 0) {
    return 0
  }
  return (n === 1 ? 10 % d : BIG) + stepDiv(n - 1, d)
}

const nest = (n: i32): i32 => {
  if (n <= 0) {
    return 0
  }
  return n % 2 === 0 ? (n % 3 === 0 ? 7 + nest(n - 1) : n % 5 === 0 ? 1000 : n + nest(n - 1)) : 1 + nest(n - 1)
}

/** Its `-3` step enters the header cold every time; its `n` step never does. */
const mixed = (n: i32): i32 => {
  if (n <= 0) {
    return 5
  }
  if (n % 4 === 0) {
    return -3 + mixed(n - 1)
  }
  return n + mixed(n - 1)
}

class Cell {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
  }
}

const total = (c: Cell | null): i32 => {
  if (c === null) {
    return 0
  }
  return c.value + total(c.next)
}

export const main = (): i32 => {
  const pick: i32 = process.argv.length > 1 ? parseInt(process.argv[1]) : -1
  if (pick === 0) {
    console.log(`${baseDiv(3, 0)}`)
  }
  if (pick === 1) {
    console.log(`${stepDiv(3, 0)}`)
  }
  console.log(`${swap(1, 2, 5)} ${swap(3, -1, 6)} ${swap(-4, 9, 7)}`)
  console.log(`${baseDiv(1, 3)} ${stepDiv(2, 7)}`)
  console.log(`${nest(0)} ${nest(10)} ${nest(25)} ${nest(200)}`)
  console.log(`${mixed(0)} ${mixed(9)} ${mixed(1000)}`)
  const list = new Cell(5, new Cell(-7, new Cell(9, new Cell(-2147483000, new Cell(2147483000, null)))))
  console.log(`${total(null)} ${total(list)}`)
  return 0
}
