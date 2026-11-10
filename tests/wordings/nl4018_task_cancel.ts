// NL4018: a Node promise is not a task anything can cancel, so `--emit-ts`
// refuses the cancellation calls and the bounded waits of `nish:async`.
import { cancelAfter, taskId } from "nish:async"

export async function main(): Promise<i32> {
  cancelAfter(taskId(), 10)
  return 0
}
