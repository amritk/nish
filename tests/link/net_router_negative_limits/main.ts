// A `RouterLimits` no table could work with is a programming error, not a
// request to refuse: the `Router` constructor panics naming the field.
//
// It panics, on stderr, with
//
//     RouterLimits.maxSegments: 0 is outside 1 to 256
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { Router, RouterLimits } from "nish/net/router";

export const main = (): i32 => {
  const limits = new RouterLimits();
  const fine = new Router(limits);
  console.log(`the defaults make a table of ${fine.nodeCount()} node`);
  limits.maxSegments = 0;
  const broken = new Router(limits);
  console.log(`unreachable: a table of ${broken.nodeCount()} node`);
  return 0;
};
