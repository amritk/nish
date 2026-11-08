// The task `main.ts` spawns (async_sync_main_loop in tests/run.js's link section).
import { sleep } from "nish:async"

export async function tick(label: string, ms: i32): Promise<void> {
  await sleep(ms)
  console.log(`${label} after ${ms} ms`)
}
