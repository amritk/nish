/** A node a region allocates; its name is what the test reads back. */
export class Item {
  name: string
  constructor(name: string) {
    this.name = name
  }
}

/** The child's root. */
export const make = (): Item => new Item("kid")

/** What `enter` reads from a root. */
export const nameLength = (item: Item): i32 => item.name.length
