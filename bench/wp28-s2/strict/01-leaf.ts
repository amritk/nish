// biome-ignore-all lint/plugin: the declared shape is what the example measures
// Class leaf: the only await is on something outside the program. In Nish the
// outside waits are `sleep`, `readable` and `writable` from nish:async.
import { sleep } from "nish:async"

async function pause(ms: i32): Promise<i32> {
  await sleep(ms)
  return ms
}

export async function main(): Promise<i32> {
  const waited = await pause(1)
  console.log(waited)
  return 0
}
