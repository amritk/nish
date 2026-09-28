// WP31 §6: `push` onto a ranged array through a field gives the range to its
// argument, as through a plain name, so the value enters checked: 3 passes
// and 12 panics before the count prints.
class Digits {
  items: integer<0, 9>[]

  constructor() {
    this.items = []
  }

  add(raw: i32): void {
    this.items.push(raw)
  }
}

export const main = (): number => {
  const d = new Digits()
  d.add(3)
  console.log(`${d.items[0]}`)
  d.add(12)
  console.log(`${d.items.length}`)
  return 0
}
