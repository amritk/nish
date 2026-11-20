class Leaf {
  value: number

  constructor(value: number) {
    this.value = value
  }
}

class Tree {
  kids: number[] = []
  left: Leaf = new Leaf(7)
}

const make = (): Tree => new Tree()
