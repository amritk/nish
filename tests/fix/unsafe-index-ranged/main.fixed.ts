// An index of a range over i32 is an i32 to `uncheckedGet`, so it is rewritten.
import { uncheckedGet } from "nish:unsafe"

export const pick = (xs: u8[], k: integer<0, 7>): u8 => uncheckedGet(xs, k)
