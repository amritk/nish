// --deny-panics keeps the check of `String.fromBytes(buf, from, i)` once `i`
// counts down past `from`: `const from = i` says `from <= i`, and the
// decrement takes it back.
export const before = (buf: u8[], k: i32): string => {
  if (k < 1 || k > buf.length) {
    return "";
  }
  let i = k;
  const from = i;
  i -= 1;
  return String.fromBytes(buf, from, i);
};
