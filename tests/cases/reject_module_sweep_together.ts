// The import and export forms, one to a declaration: each declaration reports
// its own rule once, and a refused import binds and loads nothing, so the
// modules named here need not exist.
import d, { one } from "./absent";
import type * as ns from "./absent";
import { two, type Three } from "./absent";
import { default as four } from "./absent";
import five = require("./absent");
export import six = five.six;
export import { seven } from "./absent";
export { one };
export * as all from "./absent";
export default function eight(): i32 {
  return 8;
}
export default interface Nine {
  x: i32;
}
export = one;
export as namespace Ten;
