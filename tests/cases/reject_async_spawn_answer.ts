// `spawn` drops its task's answer, so the task answers `void` or a `Result`
// it reports itself (NL2628).
import { spawn } from "nish:async"

async function load(x: i32): Promise<i32> {
  return x
}

async function run(): Promise<void> {
  spawn(load(1))
}

export const main = (): i32 => 0
