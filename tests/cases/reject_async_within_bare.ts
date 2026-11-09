// A bounded wait is a wait on the executor, so it is written only where it
// is awaited (NL2671), as `readable` is.
import { writableWithin } from "nish:async"

async function run(): Promise<void> {
  writableWithin(1, 10)
}

export const main = (): i32 => 0
