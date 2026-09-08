// `x op= e` for the six bitwise operators: the same load-apply-store the `+=`
// family uses, with the operand types of `&` and the shift-count mask, which
// folds for the literal count and costs one `and` for the variable one.
export function test(): number {
  let x = 255;
  x &= 60;
  x |= 3;
  x ^= 5;
  x <<= 2;
  x >>= 1;
  x >>>= 3;
  const n = 2;
  x <<= n;
  return x;
}
