// `sleep` is a wait on the executor, written only where it is awaited
// (NL2671): a bare call would make a wait nothing resumes.
import { sleep } from "nish:async"

async function run(): Promise<void> {
  sleep(10)
}

export const main = (): i32 => 0
