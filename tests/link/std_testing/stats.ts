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
