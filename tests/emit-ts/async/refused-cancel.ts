// WP49 stage 5: a Node promise is not a task the executor can cancel, so
// `--emit-ts` refuses the cancellation calls and the bounded waits (NL4018)
// and writes nothing.
import { cancelAfter, taskId } from "nish:async"

export async function main(): Promise<i32> {
  cancelAfter(taskId(), 10)
  return 0
}
