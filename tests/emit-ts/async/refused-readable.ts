// WP49 stage 5: a wait on a descriptor has no translation, because Node polls
// no descriptor JavaScript can name, so `--emit-ts` refuses it (NL4017) at
// the wait and writes nothing. `sleep` beside it would translate.
import { readable, sleep } from "nish:async"

export async function main(): Promise<i32> {
  await sleep(1)
  const ok = await readable(0)
  return ok ? 0 : 1
}
