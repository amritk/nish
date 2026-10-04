// `"nish".noPanic` (docs/LANGUAGE.md, "The no-panic scope"): a module the
// root package lists is held to no panic site, and the same index in a module
// it does not list (`util.ts`) is not reported. The index is read from text,
// so no call site proves it either.
import { firstField } from "./parse";
import { pick } from "./util";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const at = parseInt("1");
  return firstField(xs, at) + pick(xs, at);
};
