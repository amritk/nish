// Run by the WP15 §4 block of tests/run.js: must exit 1 with
// "slice out of range: [4, 2) of length 5" on stderr. The reversed pair is the
// case that separates `slice` from `substring` — JavaScript's `substring`
// swaps the ends and answers "ll", and the fast slice refuses instead of
// paying for the two `llvm.smin` / `llvm.smax` calls that would do the swap.
const cut = (s: string, from: number, to: number): string => s.slice(from, to);

export const main = (): number => {
  console.log(cut("hello", 1, 3));
  console.log(cut("hello", 4, 2));
  return 0;
};
