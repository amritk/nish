// WP40: the lockfile has no row for `pkg_pure`, which reaches nothing, so
// there is nothing for the row to record and the build passes. The exit
// code is 3.
import { three } from "pkg_pure";

export const main = (): i32 => three();
