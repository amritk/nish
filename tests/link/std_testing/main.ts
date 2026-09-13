// `std/testing` end to end: a module, its tests, and the harness, as three
// modules of one program. The point of the case is that a Nish program can test
// itself with no Node anywhere — the exit code and the report below are the
// binary's own.
import { Suite } from "../../../std/testing";
import { countAbove, describe, describeLines, sumOf } from "./stats";

export const main = (): number => {
  const t = new Suite("stats");
  const xs: i32[] = [3, 9, 4, 9];

  t.eqI32("sumOf", sumOf(xs), 25);
  t.eqI32("sumOf of an empty array", sumOf([]), 0);
  t.eqI32("countAbove", countAbove(xs, 4), 2);
  t.eqI32("countAbove the largest element", countAbove(xs, 9), 0);
  t.ok("sumOf is not the length", sumOf(xs) !== xs.length);
  t.eqBool("countAbove found something", countAbove(xs, 4) > 0, true);

  // The assertions over text: a fragment of a rendered report, every fragment of
  // one, and a report compared line by line.
  t.contains("describe names the sum", describe(xs, 4), "sum=25");
  t.containsAll("describe names both figures", describe(xs, 4), ["sum=25", "above=2"]);
  t.eqLines("describeLines", describeLines(xs, 4), ["count=4", "sum=25", "above=2"]);

  // The guard idiom: an out-of-range index panics and ends the process, so a
  // check that a later read depends on has to be a branch and not a line.
  if (!t.eqI32("length", xs.length, 4)) {
    return t.done();
  }
  t.eqI32("last element", xs[3], 9);

  t.skip("i64 reduction", "stats.ts has no i64 path yet");
  return t.done();
};
