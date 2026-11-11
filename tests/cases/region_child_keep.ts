// A child region keeps a string and a node from its parent's root and reads
// them after the parent's `enter` has returned: the parent outlives the child.
import { Region, childWith, enter, free, region } from "nish:region"

class Item {
  name: string
  constructor(name: string) {
    this.name = name
  }
}

class Holder {
  item: Item
  label: string
  constructor(item: Item) {
    this.item = item
    this.label = item.name
  }
}

const build = (): Item => new Item("root" + "-item")
const hold = (item: Item): Holder => new Holder(item)
const keep = (root: Item): Region<Holder> => childWith(root, hold)
const read = (h: Holder): i32 => {
  console.log(h.label)
  console.log(h.item.name)
  return h.label.length
}

export const main = (): i32 => {
  const parent: Region<Item> = region(build)
  const kept: Region<Holder> = enter(parent, keep)
  console.log(enter(kept, read))
  free(parent)
  return 0
}
