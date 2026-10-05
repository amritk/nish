// `uncheckedGet` takes a readonly array, so a read through one is rewritten.
export const first = (xs: readonly f64[], k: i32): f64 => xs[k]
