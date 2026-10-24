// A line break, a tab or a comment between `Math` and `.tan` is still a call into
// std/math.ts: the checker finds the call in the tree, not in the source text.
export const main = (): i32 => {
  const x = toF64(1);
  console.log(Math
    .tan(x));
  console.log(Math	.atan2(x, -x));
  console.log(Math /* c */ .hypot(x, x));
  return 0;
};
