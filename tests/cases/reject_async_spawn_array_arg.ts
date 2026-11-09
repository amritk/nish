// WP49 stage 5, part 3: a task shares an object or an array its spawner hands
// it, but an argument that may be absent, `T[] | null`, is neither copied nor
// shared, so it is refused (NL2673).
import { spawn } from "nish:async"

async function sum(xs: i32[] | null): Promise<void> {
  console.log(xs === null ? 0 : xs.length)
}

async function run(): Promise<void> {
  const xs: i32[] | null = [1, 2, 3]
  spawn(sum(xs))
}

export const main = (): i32 => 0
