// NL2249: with a radix a number's `toString` names no template literal, since
// a template literal has no radix (#1632).
export const main = (): i32 => {
  const n: i64 = 255;
  console.log(n.toString(16));
  return 0;
};
