// The other half of `std/testing`: what a failing check prints, and that the
// program's exit code is 1. Every assertion here fails on purpose, so the
// expected stdout is the wording of each message — change one and this case is
// the diff that says so.
import { Suite } from "../../../std/testing";

const half: f64 = 0.5;
const quarter: f64 = 0.25;
const tolerance: f64 = 0.01;

/**
 * 300 bytes, built rather than written out: the point of the check that reads it
 * is the excerpt, and a literal that long in the middle of a test program would
 * be read as the subject instead of as the fixture.
 */
const longHaystack = (): string => {
  const parts: string[] = [];
  let i: i32 = 0;
  while (i < 30) {
    parts.push("0123456789");
    i += 1;
  }
  return parts.join("");
};

export const main = (): number => {
  const t = new Suite("failures");

  t.ok("ok", false);
  t.eqBool("eqBool", true, false);
  t.eqI32("eqI32", 1, 2);
  t.eqI64("eqI64", toI64(1), toI64(2));
  t.eqF64("eqF64", half, quarter);
  t.nearF64("nearF64", half, quarter, tolerance);
  t.eqStr("eqStr", "", " ");
  t.contains("contains", "PASS  ok", "FAIL");
  t.containsAll("containsAll with one fragment missing", "sum=25", ["sum=25", "above=2"]);
  // A blank fragment is ignored rather than counted, so the two named below are
  // the whole of the report: this is the line that says a blank line in an
  // expectation file costs the caller no filtering.
  t.containsAll("containsAll with two fragments missing", "sum=25", ["above=2", "", "sum=25", "count=4"]);
  t.eqLines("eqLines on a differing line", ["a", "x"], ["a", "b"]);
  t.eqLines("eqLines when the actual ran out", ["a"], ["a", "b"]);
  t.eqLines("eqLines when the expected ran out", ["a", "b"], ["a"]);
  // A haystack longer than the excerpt: the detail quotes its first 200 bytes
  // and names the length, because a failure detail is not a place to print 300.
  t.contains("contains in a long haystack", longHaystack(), "abc");
  t.fail("fail with no detail", "");

  // A pass and a skip among the failures: the summary counts all three, and the
  // recap names only what failed.
  t.pass("pass");
  t.skip("skip", "nothing to run");
  return t.done();
};
