// The same rule on a local holder: a checked `xs[i]` proves `xs[i]` again, a
// checked `s.charCodeAt(k)` proves `s.charCodeAt(k)` again, and a checked
// literal index `xs[2]` proves `xs.length >= 3`, which proves `xs[0]` and
// `xs[1]` after it. `pick` has one check per index and `scan` one per string.
const pick = (xs: i32[], i: i32): i32 => {
  const first = xs[i];
  xs[i] = first * 2;
  return xs[i] + first;
};

const scan = (s: string, k: i32): i32 => s.charCodeAt(k) + s.charCodeAt(k);

const lowest = (xs: i32[]): i32 => xs[2] + xs[0] + xs[1];

export const test = (): number => pick([5, 6, 7], 1) + scan("abc", 2) + lowest([1, 2, 3]);
