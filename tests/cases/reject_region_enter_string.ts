// NL2611: a string is region memory, not a copy, so `enter` may not answer it.
import { Region, enter, enterWith, free, region, regionWith } from "nish:region"

class Room {
  name: string
  constructor(name: string) {
    this.name = name
  }
}

const make = (): Room => new Room("hall")
const nameOf = (room: Room): string => room.name

export const main = (): i32 => {
  const r = region(make)
  const name = enter(r, nameOf)
  free(r)
  console.log(name)
  return 0
}
