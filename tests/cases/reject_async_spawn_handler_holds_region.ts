// WP49 stage 5, part 8: a spawn arrow may capture an object only when it holds
// nothing a task may not share; `box` holds a `Region` in a field, which the
// frame that made it frees, perhaps while the task still waits (NL2690).
import { sleep, spawn } from "nish:async"
import { Region, region } from "nish:region"

class Box {
  hits: i32 = 0
  r: Region<i32[]>
  constructor(r: Region<i32[]>) {
    this.r = r
  }
}

const build = (): i32[] => {
  const xs: i32[] = [1, 2, 3]
  return xs
}

async function each(f: (n: i32) => void, ms: i32): Promise<void> {
  await sleep(ms)
  f(ms)
}

export async function main(): Promise<i32> {
  const box = new Box(region(build))
  spawn(each((n: i32): void => {
    box.hits = box.hits + n
  }, 5))
  await sleep(10)
  return 0
}
