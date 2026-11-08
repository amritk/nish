import { sleep, spawn } from "nish:async"

class Tally {
  hits: i32 = 0
}

const count = async (tally: Tally, n: i32): Promise<void> => {
  await sleep(n)
  tally.hits = tally.hits + n
}

const start = async (tally: Tally): Promise<void> => {
  spawn(count(tally, 5))
  await sleep(1)
}

export const main = async (): Promise<i32> => {
  const tally = new Tally()
  await start(tally)
  await sleep(10)
  return tally.hits
}
