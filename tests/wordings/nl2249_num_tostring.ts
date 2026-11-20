// NL2249: a `u8`'s `toString()` is refused, and the message names `${b}`.
export const main = (): i32 => {
  const b: u8 = 1;
  console.log(b.toString());
  return 0;
};
