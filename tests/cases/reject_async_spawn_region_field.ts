// WP49 stage 5, part 3: a shared object that holds a `Region` in a field is
// refused as a spawn argument, as a bare `Region` is: the frame that made the
// region frees it, perhaps while the task still waits.
import { sleep, spawn } from "nish:async"
import { Region, region } from "nish:region"

class Box {
  r: Region<i32[]>
  constructor(r: Region<i32[]>) {
    this.r = r
  }
}

const build = (): i32[] => {
  const xs: i32[] = [1, 2, 3]
  return xs
}

const sumLater = async (box: Box, ms: i32): Promise<void> => {
  await sleep(ms)
  console.log(box.r === box.r ? 1 : 0)
}

export const main = async (): Promise<i32> => {
  const box = new Box(region(build))
  spawn(sumLater(box, 5))
  await sleep(10)
  return 0
}
