// A bounded wait takes two `i32`s (NL2692): the descriptor, and the most
// milliseconds it waits before it answers false.
import { readableWithin } from "nish:async"

async function run(): Promise<void> {
  await readableWithin(1)
}

export const main = (): i32 => 0
