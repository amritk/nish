// With a radix there is no template-literal spelling, so the refusal names
// none (#1632).
export const main = (): i32 => {
  const n: i64 = 255;
  console.log(n.toString(16));
  return 0;
};
