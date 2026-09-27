// WP15 §8: literal spellings neither compiler folds, so neither warns about
// them. Stage0 has `Number` and stage1 does not, and `ts.NumericLiteral.text`
// is normalised — `0x20` arrives as `"32"` — so folding the normalised text
// would fold exactly the spellings stage1 refuses and the two compilers would
// disagree about whether to warn. Both read the literal as written instead.
//
// `0x20` is chosen so that folding it *would* warn: it is exactly the width of
// an i32, so a compiler that read the normalised text would report a masked
// shift here. Neither does.
//
// The other spellings `docs/LANGUAGE.md` accepts — binary, octal, exponent
// and separated — are read at their true value by the number path since #267
// and are pinned by `literal_spellings`, not here: this case is about the
// warning, and a spelling the fold does not read is one it does not warn on.
export function test(): number {
  const hexShift = 1 << 0x20;
  return hexShift;
}
