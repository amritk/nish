// A diagnostic column is counted in UTF-16 code units, not in the bytes the
// self-hosted compiler stores a source file as: `é` is two bytes and one
// column, `🎉` is four bytes and two. Both sit before the caret here, so the
// two counts differ by three and every surface that carries a column says so
// — the report and its caret, `--emit-checked`, and `--json`'s `column` and
// `endColumn`.
//
// No corpus program had a non-ASCII character in front of a caret before this
// one, so the two compilers were free to disagree about all of it and did
// (WP19 §A5: an empty difference set is a fact about the corpus).
export const main = (): number => {
  const cafe = "café 🎉"; const n: i32 = cafe;
  return n;
};
