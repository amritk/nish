// `new` initializers that name imported classes, stored before the
// constructor body runs, in declaration order.
import { Leaf, Tally } from "./leaf"

class Tree {
  left: Leaf = new Leaf(4)
  right: Leaf = new Leaf(-1, "right")
  tally: Tally = new Tally()

  constructor(extra: i32) {
    this.left.value = this.left.value + extra
    this.tally.counts.push(extra)
  }
}

export const main = (): i32 => {
  const tree = new Tree(3)
  console.log(tree.left.value)
  console.log(tree.left.label)
  console.log(tree.right.label)
  console.log(tree.tally.counts.length)
  return tree.right.value + 1
}
