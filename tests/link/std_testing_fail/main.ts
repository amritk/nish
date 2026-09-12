// The other half of `std/testing`: what a failing check prints, and that the
// program's exit code is 1. Every assertion here fails on purpose, so the
// expected stdout is the wording of each message — change one and this case is
// the diff that says so.
import { Suite } from "../../../std/testing";

const half: f64 = 0.5;
const quarter: f64 = 0.25;
const tolerance: f64 = 0.01;

export const main = (): number => {
  const t = new Suite("failures");

  t.ok("ok", false);
  t.eqBool("eqBool", true, false);
  t.eqI32("eqI32", 1, 2);
  t.eqI64("eqI64", toI64(1), toI64(2));
  t.eqF64("eqF64", half, quarter);
  t.nearF64("nearF64", half, quarter, tolerance);
  t.eqStr("eqStr", "", " ");
  t.fail("fail with no detail", "");

  // A pass and a skip among the failures: the summary counts all three, and the
  // recap names only what failed.
  t.pass("pass");
  t.skip("skip", "nothing to run");
  return t.done();
};
