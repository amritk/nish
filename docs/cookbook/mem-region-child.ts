import { Region, childWith, enter, free, region } from "nish:region"

class Name {
  text: string
  constructor(text: string) {
    this.text = text
  }
}

class Use {
  name: Name
  constructor(name: Name) {
    this.name = name
  }
}

const open = (): Name => new Name("total")
const hold = (name: Name): Use => new Use(name)
const keep = (name: Name): Region<Use> => childWith(name, hold)
const length = (u: Use): i32 => u.name.text.length

export const serveOnce = (): i32 => {
  const parent = region(open)
  const kid = enter(parent, keep)
  const n = enter(kid, length)
  free(parent)
  return n
}
