// NL4017: Node polls no descriptor JavaScript can name, so a task that awaits
// `readable` has no translation, and `--emit-ts` refuses it at the wait.
import { readable } from "nish:async"

export async function main(): Promise<i32> {
  const ok = await readable(0)
  return ok ? 0 : 1
}
