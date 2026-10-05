// A store as a statement becomes `uncheckedSet`, and the import goes after the
// module's last one. The value is a call, which a plain store evaluates once
// either way.
import { clamp } from "./clamp"
import { uncheckedSet } from "nish:unsafe"

export const put = (xs: f64[], k: i32, v: f64): void => {
  uncheckedSet(xs, k, clamp(v))
}
