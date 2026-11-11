// A grandchild chain: each region is made inside its parent's `enter` and
// keeps what its parent's root reaches; freeing the root frees all three.
import { Region, childWith, enter, free, region } from "nish:region"

class Level {
  depth: i32
  name: string
  up: Level | null
  constructor(depth: i32, name: string, up: Level | null) {
    this.depth = depth
    this.name = name
    this.up = up
  }
}

const top = (): Level => new Level(0, "top", null)
const below = (up: Level): Level => new Level(up.depth + 1, up.name + "/" + `${up.depth + 1}`, up)
const descend = (up: Level): Region<Level> => childWith(up, below)
const walk = (at: Level): i32 => {
  let sum: i32 = 0
  let level: Level | null = at
  while (level !== null) {
    console.log(level.name)
    sum = sum + level.depth
    level = level.up
  }
  return sum
}

export const main = (): i32 => {
  const root: Region<Level> = region(top)
  const middle: Region<Level> = enter(root, descend)
  const leaf: Region<Level> = enter(middle, descend)
  console.log(enter(leaf, walk))
  free(root)
  return 0
}
