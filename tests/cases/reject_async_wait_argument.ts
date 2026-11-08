// A wait takes one `i32` (NL2672): `sleep` its milliseconds, `readable` and
// `writable` their descriptor.
import { readable } from "nish:async"

async function run(): Promise<void> {
  await readable(1, 2)
}

export const main = (): i32 => 0
