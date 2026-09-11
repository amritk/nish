// WP15 §8: literal spellings neither compiler folds, so neither warns about
// them. Stage0 has `Number` and stage1 does not, and `ts.NumericLiteral.text`
// is normalised — `0x20` arrives as `"32"` — so folding the normalised text
// would fold exactly the spellings stage1 refuses and the two compilers would
// disagree about whether to warn. Both read the literal as written instead.
//
// Both values below are chosen so that folding them *would* warn: `0x20` is at
// the width of an i32, and `1e5 * 1e5` does not fit one. Which is also why
// there is no `.out` — the multiplication is an overflowing signed `*` under
// the default `nsw`, and a golden that runs undefined behaviour pins whatever
// LLVM happened to do that week.
//
// A separator (`100_000`) belongs in this list and is missing from it on
// purpose: `docs/LANGUAGE.md` accepts one, stage0 does too, and stage1 refuses
// it with `Non-integer literal`. That divergence is older than this rule and
// nothing to do with folding, so it is not pinned here — a case that fails for
// an unrelated reason is a case nobody can read.
export function test(): number {
  const hexShift = 1 << 0x20;
  const exponent = 1e5 * 1e5;
  return hexShift + exponent;
}
