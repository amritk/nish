// A rest array that outlives its call -- returned, stored in a field, or
// kept in an outer array -- lives in the arena, not on the caller's stack.
function keep(...xs: number[]): number[] {
  return xs
}

class Bag {
  items: number[]

  constructor(...items: number[]) {
    this.items = items
  }

  size(): number {
    return this.items.length
  }
}

export function main(): void {
  const a = keep(1, 2, 3)
  const b = keep(4, 5)
  console.log(a.length + b.length)
  console.log(a[0] + a[2] + b[1])
  const bag = new Bag(7, 8, 9)
  console.log(bag.size())
  console.log(bag.items[1])
  const empty = new Bag()
  console.log(empty.size())
  const outer: number[][] = []
  for (let i = 0; i < 3; i = i + 1) {
    outer.push(keep(i, i * 10))
  }
  let sum = 0
  for (const row of outer) {
    sum = sum + row[0] + row[1]
  }
  console.log(sum)
  console.log(outer[2][1])
}
