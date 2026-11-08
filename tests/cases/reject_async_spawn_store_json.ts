// WP49 stage 5, part 3: `jsonDecode` stores every string, array and object it
// makes into `out`, all of it allocated in the task's region, so a task may
// not decode into an object it shares with its spawner. Its instance has no
// body of its own: the facts it is given say so.
import { sleep, spawn } from "nish:async"
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDecoder, jsonDecode } from "nish/json-typed"

class Tally {
  name: string = ""
  hits: i32 = 0
}

async function work(tally: Tally, ms: i32): Promise<void> {
  await sleep(ms)
  const d = new JsonDecoder([], 0, 0, new JsonLimits())
  jsonDecode(d, tally)
}

export async function main(): Promise<i32> {
  const tally = new Tally()
  spawn(work(tally, 1))
  await sleep(10)
  return 0
}
