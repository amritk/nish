// WP15 §2/§8: `emitSubstring` loads the receiver's length before either bound
// runs, so a fact an argument states about the receiver *after* rebinding it
// is a fact about a different string -- and folding a bound on it reads past
// the string the call actually copies from. Interleaving the verdicts with the
// arguments is not enough on its own: this bound is argument 1, so it is
// judged after argument 0 either way, and what saves it is dropping the holder
// the moment an argument writes it.
export const main = (): number => {
  let s = "hi";
  const long = "hello world";
  let n = 0;

  // Argument 0 rebinds `s` and then bounds `n` by the *new*, longer string.
  // The length the emitter loaded is the old two-byte one, so the clamp on `n`
  // has to stay: without it the copy starts at the end of `"hi"` and runs
  // nine bytes past it.
  const a = s.substring((s = long).length > 0 ? (n = s.length) : (n = s.length), n);
  console.log(`a [${a}] ${a.length}`);

  // A literal `0` is proven with no facts at all -- no string has a negative
  // length -- so it folds even after the receiver has been rebound. The golden
  // is what says the pair for it is gone and the pair for the other end stays.
  let u = "hi";
  const b = u.substring(0, (u = long).length);
  console.log(`b [${b}] ${b.length}`);
  return 0;
};
