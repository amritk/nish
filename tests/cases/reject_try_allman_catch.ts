// An Allman-style `try`: the block opens on the next line. A block followed
// by `catch` makes `try` the statement whatever the line breaks, so Phase 0
// refuses it (NL1033) rather than reading `try` as a name.
export const main = (): i32 => {
  try
  {
    return 1;
  }
  catch (e)
  {
    return 2;
  }
};
