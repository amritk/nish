// `cancel` takes a task's handle, the `i64` `taskId()` answered (NL2693); a
// call with none names no task.
import { cancel } from "nish:async"

export function main(): i32 {
  return cancel() ? 1 : 0
}
