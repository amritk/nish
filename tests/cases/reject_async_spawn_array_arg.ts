// WP49 stage 5, debt (b): a spawned task outlives its spawner, whose region
// is freed when it returns, so an array argument is refused (NL2673).
import { spawn } from "nish:async"

async function sum(xs: i32[]): Promise<void> {
  console.log(xs.length)
}

async function run(): Promise<void> {
  const xs = [1, 2, 3]
  spawn(sum(xs))
}

export const main = (): i32 => 0
