// `uncheckedGet` takes a readonly array, so a read through one is rewritten.
import { uncheckedGet } from "nish:unsafe"

export const first = (xs: readonly f64[], k: i32): f64 => uncheckedGet(xs, k)
