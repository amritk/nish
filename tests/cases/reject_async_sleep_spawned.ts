// `spawn` takes a call to an `async` function, and `sleep` is a wait, not
// one: spawning it is refused as a bare `sleep` is (NL2671).
import { sleep, spawn } from "nish:async"

async function run(): Promise<void> {
  spawn(sleep(10))
}

export const main = (): i32 => 0
