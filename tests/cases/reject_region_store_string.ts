// NL2609: a region's string stored into an outer array would point into the
// region after `free`.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region"

class Room {
  name: string
  constructor(name: string) {
    this.name = name
  }
}

const make = (): Room => new Room("hall")

const keepName = (room: Room, names: string[]): i32 => {
  names[0] = room.name
  return 0
}

export const main = (): i32 => {
  const names: string[] = [""]
  const r = region(make)
  enterWith(r, names, keepName)
  free(r)
  console.log(names[0])
  return 0
}
