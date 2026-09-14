// NL2316: the same whole-program rule NL2298 states for a generic function, one
// level up. An instantiation is defined in the module that declares its
// template (WP18 §3b), and that half has not landed, so a generic class may be
// imported by name only to be refused by name.
import { Crate } from "./wordings_generic_class";

export const main = (): i32 => {
  const c = new Crate<i32>(1);
  return c.value;
};
