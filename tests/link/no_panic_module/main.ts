// `"nish".noPanic` (docs/LANGUAGE.md, "The no-panic scope"): a module the
// root package lists is held to no panic site, and the same index in a module
// it does not list (`util.ts`) is not reported.
import { firstField } from "./parse";
import { pick } from "./util";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  return firstField(xs, 0) + pick(xs, 1);
};
