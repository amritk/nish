// NL2249: an `i64`'s `toString()` with no argument names `${n}`, as the other
// numeric types do (#1632).
export const main = (): i32 => {
  const n: i64 = 255;
  console.log(n.toString());
  return 0;
};
