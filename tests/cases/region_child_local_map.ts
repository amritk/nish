// A `Map` the entered `f` made and filled with numbers before `childWith`:
// filling it stores nothing into memory the root reaches, so the child may
// keep the root.
import { Region, childWith, enter, free, region } from "nish:region"

class Item {
  name: string
  constructor(name: string) {
    this.name = name
  }
}

class Holder {
  item: Item
  constructor(item: Item) {
    this.item = item
  }
}

const open = (): Item => new Item("root")
const hold = (i: Item): Holder => new Holder(i)
const keep = (root: Item): Region<Holder> => {
  const counts = new Map<string, i32>()
  counts.set(root.name, root.name.length)
  counts.set("other", 1)
  console.log(counts.size)
  return childWith(root, hold)
}
const show = (h: Holder): i32 => h.item.name.length

export const main = (): i32 => {
  const p = region(open)
  const kid = enter(p, keep)
  console.log(enter(kid, show))
  free(p)
  return 0
}
