// WP15 §8: the shapes a `substring` bound must not be reported for. Every call
// here either has both ends proven — in which case the clamp is gone from the
// IR, not merely quiet — or has no guard anybody could write, and a warning
// that fires where the compiler already did the right thing is what teaches
// people to ignore a whole diagnostic class.
export const test = (): number => {
  const s = "hello world";
  let total = 0;

  // Proven by a guard that reaches the call: both ends are inside the string.
  let i = 0;
  while (i < 4) {
    const a = i;
    const b = i + 1;
    if (a >= 0 && a <= s.length && b >= 0 && b <= s.length) {
      total = total + s.substring(a, b).length;
    }
    i = i + 1;
  }

  // A literal `0` is proven for every string, because none has a negative
  // length, and the hoisted length proves the other end.
  const n = s.length;
  let j = 0;
  while (j < 4) {
    total = total + s.substring(0, n).length;
    j = j + 1;
  }

  // Outside any loop the clamp runs once, which is nothing anybody is paying
  // for, so an unproven bound there is silent as well.
  const at = total - total;
  total = total + s.substring(at, at + 1).length;

  // A bound that is not a plain local has no guard to write in the first place.
  let k = 0;
  while (k < 2) {
    total = total + s.substring(k + 1, s.length).length;
    k = k + 1;
  }
  return total;
};
