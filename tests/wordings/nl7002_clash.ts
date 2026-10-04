// NL7002: the module declares `uncheckedGet` itself, so the import a fix
// would add collides with it and the read is reported without one.
const uncheckedGet = (x: i32): i32 => x * 2;

export const twice = (xs: i32[], k: i32): i32 => uncheckedGet(xs[k]);
