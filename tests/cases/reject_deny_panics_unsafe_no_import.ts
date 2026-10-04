// --deny-panics allows `uncheckedGet` only behind its opt-in, the
// `nish:unsafe` import at the top of the module (`deny_panics_unsafe`). The
// global spelling `tsc` accepts has no opt-in to show, and is refused (NL2456)
// with or without the flag, so no module in the scope reaches an unchecked
// index that nothing at its top admits to.
export const first = (xs: i32[]): i32 => uncheckedGet(xs, 0);
