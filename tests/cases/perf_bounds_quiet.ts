// WP15 §8: the guard cases. Every access here is proven, so no bounds check is
// emitted and nothing at all is reported — a warning that fires where the
// compiler already did the right thing is what teaches people to ignore a
// whole diagnostic class.
export const test = (): number => {
  const xs = [1, 2, 3];
  let total = 0;

  // Proven by the loop condition.
  for (let i = 0; i < xs.length; i = i + 1) {
    total = total + xs[i];
  }

  // Proven by the hoisted length.
  const n = xs.length;
  let j = 0;
  while (j < n) {
    total = total + xs[j];
    j = j + 1;
  }

  // Proven by the length guard, for a constant index.
  if (xs.length >= 2) {
    total = total + xs[1];
  }

  // Proven by the literal length of the array itself.
  const fixed = [10, 20];
  let m = 0;
  while (m < 2) {
    total = total + fixed[m];
    m = m + 1;
  }

  // Outside any loop there is one check at most, which is not a check anybody
  // is paying for, so an unproven access there is silent as well.
  const at = total - total;
  total = total + xs[at];

  // `for...of` has no index to prove.
  for (const x of xs) {
    total = total + x;
  }
  return total;
};
