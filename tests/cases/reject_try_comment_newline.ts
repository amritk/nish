// A block comment with a line break in it between `try` and its block: the
// `catch` after the block makes this the statement (NL1033), so the comment
// does not change which rule refuses it.
export const main = (): i32 => {
  try /* a comment
  across two lines */ { return 1; } catch (e) { return 2; }
};
