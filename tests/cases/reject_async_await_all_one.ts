// `awaitAll` of one call: it joins two to eight, one name per call
// (NL2647).
import { awaitAll } from "nish:async"

async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<void> {
  const [a] = await awaitAll(load(1))
}

export const main = (): i32 => 0
