// An argument is evaluated once, left to right, whether it fills a default's
// place or gathers into a rest, as in TypeScript; and a class instance gathered
// into a rest is the caller's object, so the callee's write reaches it.
class Clock {
  n: number

  constructor() {
    this.n = 0
  }

  next(): number {
    this.n = this.n + 1
    return this.n
  }
}

function area(w: number, h: number = 2): number {
  return w * h
}

function total(...xs: number[]): number {
  let sum = 0
  for (const x of xs) {
    sum = sum * 10 + x
  }
  return sum
}

class Cell {
  v: number

  constructor(v: number) {
    this.v = v
  }
}

function bumpAll(...cs: Cell[]): void {
  for (const c of cs) {
    c.v = c.v + 100
  }
}

export function main(): void {
  const c = new Clock()
  console.log(area(c.next()))
  console.log(c.n)
  console.log(total(c.next(), c.next(), c.next()))
  console.log(c.n)
  const p = new Cell(1)
  const q = new Cell(2)
  bumpAll(p, q)
  console.log(p.v)
  console.log(q.v)
}
