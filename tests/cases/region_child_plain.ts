// A plain region whose root has the same type as a child's: its `enter` may
// grow its root and store new memory into it, which a child's may not.
import { Region, child, enter, free, region } from "nish:region"

class Item {
  name: string
  constructor(name: string) {
    this.name = name
  }
}

class Box {
  first: Item
  items: Item[]
  constructor(first: Item) {
    this.first = first
    this.items = [first]
  }
}

const make = (): Box => new Box(new Item("root"))
const makeKid = (): Box => new Box(new Item("kid"))
const spawnChild = (root: Box): Region<Box> => child(makeKid)
const grow = (root: Box): i32 => {
  root.items.push(new Item(`item${root.items.length}`))
  root.first = root.items[root.items.length - 1]
  return root.items.length
}
const show = (root: Box): i32 => {
  for (const item of root.items) {
    console.log(item.name)
  }
  console.log(root.first.name)
  return root.items.length
}

export const main = (): i32 => {
  const p = region(make)
  const kid = enter(p, spawnChild)
  enter(p, grow)
  enter(p, grow)
  console.log(enter(p, show))
  console.log(enter(kid, show))
  free(p)
  return 0
}
