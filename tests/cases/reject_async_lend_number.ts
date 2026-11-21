// `lend` borrows an object or an array: a number is copied into the task
// anyway, so there is no view to lend.
import { lend } from "nish:async"

export const main = (): i32 => lend(3)
