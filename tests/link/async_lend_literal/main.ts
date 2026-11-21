// WP49 stage 6 (NL2822): a lent view put into an array literal keeps its lent
// origin across the module boundary. `tagFirst` stores a task-region array
// into the literal's first element, the spawner's request, so the call that
// hands it the literal is refused.
import { lend, sleep, spawn } from "nish:async"
import { Req, tagFirst } from "./lib"

async function keeps(r: Req): Promise<void> {
  tagFirst([lend(r)], "seen")
}

export async function main(): Promise<i32> {
  const r = new Req()
  spawn(keeps(r))
  await sleep(5)
  return 0
}
