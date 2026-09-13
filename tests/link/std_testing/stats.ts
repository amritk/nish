// The subject under test: two total reductions over i32[], so the suite next
// door has something real to check rather than checking itself.

export const sumOf = (xs: i32[]): i32 => {
  let total: i32 = 0;
  for (const x of xs) {
    total += x;
  }
  return total;
};

/** How many elements are strictly greater than `limit`. */
export const countAbove = (xs: i32[], limit: i32): i32 => {
  let seen: i32 = 0;
  for (const x of xs) {
    if (x > limit) {
      seen += 1;
    }
  }
  return seen;
};

/**
 * The two reductions as one line, so the suite next door has something to point
 * `contains` and `containsAll` at: an assertion over a rendered report is what a
 * program checks when the value under test is text rather than a number.
 */
export const describe = (xs: i32[], limit: i32): string =>
  `sum=${sumOf(xs)} above=${countAbove(xs, limit)}`;

/**
 * The same figures as a report of one line each, which is what `eqLines` is for:
 * the first differing line is the diagnostic, and comparing the two texts as one
 * string would print both of them instead.
 */
export const describeLines = (xs: i32[], limit: i32): string[] => [
  `count=${toI32(xs.length)}`,
  `sum=${sumOf(xs)}`,
  `above=${countAbove(xs, limit)}`,
];
