// WP15 §8: a `substring` bound the §2 analysis could not place in
// `[0, s.length]`, inside a loop. The clamp JavaScript specifies stays on that
// bound, so the call pays an `llvm.smin` and an `llvm.smax` every pass; the
// message names the guard that would take them away and the `slice` that has
// no clamp at all. The program is legal and still exits 0.
//
// The receiver here is a string literal in a local, which is exactly the shape
// `opt -O3` can hoist a length out of: this file's pre-fold IR folds from six
// intrinsic calls to none unaided. The warning fires anyway, and should -- it
// is about the bound the §2 proof could not place, not about whether a later
// pass happens to reach this shape -- which is why `NL9009` says the optimiser
// folds the clamp "only where it can hoist the receiver's length" rather than
// never (WP15 §9). The trigger stays on the bound; it does not ask what the
// receiver is.
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
