// A `break` must name a label of a statement around it: `inner` is not one.
export function test(): number {
  let n = 0;
  outer: while (n < 3) {
    n += 1;
    break inner;
  }
  return n;
}
