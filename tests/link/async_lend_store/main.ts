// WP49 stage 6 (NL2822): a task reads its spawner's request in place through
// `lend`, and the region walk follows the view across the module boundary.
// `pathOf` only reads it, so the first task compiles; `remember` stores an
// array the task allocated into it, which would leave the spawner's request
// pointing into the task's region once that is freed, so the second is
// refused at the call that hands the view on.
import { lend, sleep, spawn } from "nish:async"
import { Req, pathOf, remember } from "./lib"

async function reads(r: Req): Promise<void> {
  console.log(pathOf(lend(r)))
}

async function keeps(r: Req): Promise<void> {
  remember(lend(r), "seen")
}

export async function main(): Promise<i32> {
  const r = new Req()
  spawn(reads(r))
  spawn(keeps(r))
  await sleep(5)
  return 0
}
