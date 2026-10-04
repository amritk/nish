// `"nish".noPanic` and a callee that uses `nish:unsafe`: `uncheckedGet` cannot
// panic, and `pkg_raw`'s import of it is the opt-in, so the call from this
// listed module is not a `call` site and is not refused (NL2458), where a call
// into an unproven index is (`no_panic_transitive`). The exit code is 5.
import { raw } from "pkg_raw";

export const main = (): i32 => {
  const xs: i32[] = [4, 5];
  return raw(xs, 1);
};
