// --deny-panics keeps the check of `String.fromBytes(buf, i, end)` once `i`
// counts up past `end`: `const end = i` says `i <= end`, and the increment of
// the smaller end takes it back.
export const after = (buf: u8[], k: i32): string => {
  if (k < 0 || k >= buf.length) {
    return "";
  }
  let i = k;
  const end = i;
  i += 1;
  return String.fromBytes(buf, i, end);
};
