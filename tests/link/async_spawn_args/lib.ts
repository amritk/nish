// The task `main.ts` spawns (async_spawn_args in tests/run.js's link section).
import { sleep } from "nish:async"

export async function report(name: string, tail: string, n: i32, big: i64, half: f64, on: boolean, ms: i32): Promise<void> {
  await sleep(ms)
  console.log(`${name}: ${tail.length} chars ending ${tail.slice(tail.length - 3)}, ${n}, ${big}, ${half}, ${on}`)
}
