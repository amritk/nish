// Constructors and methods take defaults and a rest parameter as functions do.
class Counter {
  count: number
  step: number

  constructor(start: number = 0, step: number = 1) {
    this.count = start
    this.step = step
  }

  bump(times: number = 1): number {
    this.count = this.count + this.step * times
    return this.count
  }

  addAll(...xs: number[]): number {
    for (const x of xs) {
      this.count = this.count + x
    }
    return this.count
  }
}

export function main(): void {
  const c = new Counter()
  console.log(c.bump())
  console.log(c.bump(3))
  console.log(c.addAll())
  console.log(c.addAll(1, 2))
  const d = new Counter(5, 2)
  console.log(d.bump())
  const e = new Counter(10)
  console.log(e.bump(2))
}
