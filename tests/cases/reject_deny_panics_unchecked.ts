// --deny-panics refuses `uncheckedGet` and `uncheckedSet`: they drop the
// check without a proof, so an index out of range is undefined behaviour.
import { uncheckedGet } from "nish:unsafe";

export const first = (xs: i32[]): i32 => uncheckedGet(xs, 0);
