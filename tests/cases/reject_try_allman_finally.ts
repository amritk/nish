// An Allman-style `try` with only a `finally`: refused as the statement it is
// (NL1033), because a block followed by `finally` settles what `try` means.
export const main = (): i32 => {
  let n: i32 = 0;
  try
  {
    n = 1;
  }
  finally
  {
    n = 2;
  }
  return n;
};
