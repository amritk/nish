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
// Three other spellings belong in this case and are missing from it on
// purpose. `docs/LANGUAGE.md` accepts hexadecimal, binary, octal, exponent and
// separated literals; stage1 handles decimal and hexadecimal, refuses `0b101`,
// `0o17` and `1_000`, and — worse — reads `1e5` as `245`. Those divergences
// are older than this rule and have nothing to do with folding, so they are
// not pinned here: a case that fails for an unrelated reason is a case nobody
// can read. They want their own change, in the number path, with its own
// tests.
export function test(): number {
  const hexShift = 1 << 0x20;
  return hexShift;
}
