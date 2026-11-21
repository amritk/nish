// A constant table cannot be stored in a mutable `T[]` field of a class.
const TAB: readonly u8[] = [1, 2, 3]

class Holder {
  items: u8[]

  constructor(items: u8[]) {
    this.items = items
  }
}

export const main = (): void => {
  const h = new Holder([toU8(0)])
  h.items = TAB
  console.log(`${h.items.length}`)
}
