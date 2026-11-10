// The entered `f` fills a list it made itself before handing the root to a
// child: the list holds only a new string, so the root still holds nothing
// this `enter` allocated and the child may keep it.
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
  const tmp: string[] = []
  tmp.push("a" + root.name)
  console.log(tmp[0])
  return childWith(root, hold)
}
const show = (h: Holder): i32 => {
  console.log(h.item.name)
  return h.item.name.length
}

export const main = (): i32 => {
  const p = region(open)
  const kid = enter(p, keep)
  console.log(enter(kid, show))
  free(p)
  return 0
}
