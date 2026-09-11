// WP15 §8: literal spellings neither compiler folds, so neither warns about
// them. Stage0 has `Number` and stage1 does not, and `ts.NumericLiteral.text`
// is normalised — `0x20` arrives as `"32"` — so folding the normalised text
// would fold exactly the spellings stage1 refuses and the two compilers would
// disagree about whether to warn. Both read the literal as written instead.
//
// Every value below is chosen so that folding it *would* warn: `0x20` is at
// the width of an i32, and `100_000 * 100_000` does not fit one. Which is also
// why there is no `.out` — the multiplication is an overflowing signed `*`
// under the default `nsw`, and a golden that runs undefined behaviour pins
// whatever LLVM happened to do that week.
export function test(): number {
  const hexShift = 1 << 0x20;
  const separated = 100_000 * 100_000;
  const exponent = 1e5 * 1e5;
  return hexShift + separated + exponent;
}
