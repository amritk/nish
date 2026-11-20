// The no-panic default (docs/LANGUAGE.md, "The no-panic scope"): with no
// `noPanic` list, every module of the root package is held to no panic site.
// `strict` keeps the harness from passing `--allow-panics`, as it does to
// every other program. The index is read from text, so no call site proves
// it, and `trim` reaches a panic site in std/, which a module in the scope
// may not call yet.
import { trim } from "nish/text";
import { pick } from "./util";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const at = parseInt(trim(" 1 "));
  return pick(xs, at);
};
