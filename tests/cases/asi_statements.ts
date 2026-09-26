// Every statement here ends without a semicolon, where TypeScript would insert
// one: at a line break, before a `}` and at the end of the file. The program
// prints what Node prints, and its IR is the IR of the same program written
// with semicolons.
class Counter {
  n: i32 = 0
  label: string = "c"
  bump(): void {
    this.n = this.n + 1
  }
}

interface Pair {
  a: i32
  b: i32
}

type Count = i32

const twice = (x: i32): i32 => x * 2

const total = (xs: i32[]): Count => {
  let sum: i32 = 0
  for (const x of xs) {
    if (x < 0) continue
    sum = sum + x
  }
  let i: i32 = 0
  while (true) {
    i++
    if (i > 2) break
  }
  do {
    i--
  } while (i > 0)
  return sum
}

export const main = (): number => {
  const c = new Counter()
  c.bump(); c.bump()
  const p: Pair = { a: 1, b: 2 }
  const t = total([p.a, p.b, -5])
  console.log(`${c.n} ${t} ${twice(t)}`)
  return 0
}
