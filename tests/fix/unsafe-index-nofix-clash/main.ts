// The module declares a function named `uncheckedGet`, which the import would
// collide with, so the read is reported without a fix.
const uncheckedGet = (x: i32): i32 => x * 2

export const twice = (xs: i32[], k: i32): i32 => uncheckedGet(xs[k])
