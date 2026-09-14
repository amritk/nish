// An array element is arena memory the escape analysis walks, exactly as a
// field is, so a foreign pointer cannot be one.
//
// The sentence was never what the two compilers disagreed about here: stage0
// spanned the refusal on the whole `CPtr[]` and stage1 on the element, with the
// same code and the same words, and the reject oracle compares words. Two
// things pin the span now. The `.err` beside this case adds the excerpt's caret
// run, which fixes the start column exactly in whichever compiler the oracle is
// pointed at and outlives `src/` -- a fragment match cannot fix the *end*,
// since a wider run contains a narrower one. `tests/run.js` closes that half by
// comparing this case's `--json` objects between the two compilers byte for
// byte, `endColumn` included, as it already did for `reject_multi_error`.
//
// `handles` is deliberately not read afterwards. A use of a local whose
// annotation was refused draws a follow-on `Unknown identifier` from stage0 and
// nothing from stage1 -- stage0 drops the binding, stage1 keeps it bound to an
// array of the error type -- and that is stage0's recovery for *any* refused
// element annotation (`Nope[]` does it too, and did before `CPtr` existed), not
// a fact about this rule.
export const main = (): i32 => {
  const handles: CPtr[] = [];
  return 0;
};
