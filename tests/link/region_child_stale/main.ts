// `free(parent)` frees a live child too and retires its handle, so entering
// the child afterwards panics as a stale handle.
import { Region, child, enter, free, region } from "nish:region"
import { Item, make, nameLength } from "./item"

const keep = (root: Item): Region<Item> => child(make)

export const main = (): i32 => {
  const parent: Region<Item> = region((): Item => new Item("root"))
  const kid: Region<Item> = enter(parent, keep)
  console.log(enter(kid, nameLength))
  free(parent)
  console.log("freed")
  return enter(kid, nameLength)
}
