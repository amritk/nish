// WP49 stage 5, debt (c): a `main` that never awaits is called once, like a
// synchronous one, and the executor's loop then runs every task it spawned
// before the program exits with `main`'s answer. The ticks print after
// `main` has returned, in deadline order.
import { spawn } from "nish:async"
import { tick } from "./lib"

export async function main(): Promise<i32> {
  spawn(tick("second", 20))
  spawn(tick("first", 5))
  console.log("main returns 3")
  return 3
}
