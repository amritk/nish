// WP15 §8: a `substring` bound the §2 analysis could not place in
// `[0, s.length]`, inside a loop. The clamp JavaScript specifies stays on that
// bound, so the call pays an `llvm.smin` and an `llvm.smax` every pass; the
// message names the guard that would take them away and the `slice` that has
// no clamp at all. The program is legal and still exits 0.
export const test = (): number => {
  const s = "hello world";
  let total = 0;

  // `from` and `to` walk up with nothing above them, so neither end is
  // provably inside the string and both keep their clamp.
  let step = 0;
  while (step < 4) {
    const from = step;
    const to = step + 5;
    total = total + s.substring(from, to).length;
    step = step + 1;
  }
  return total;
};
