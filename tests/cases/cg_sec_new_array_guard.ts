// The check `new Array<T>(n)` makes on a length whose type can leave the range
// an array may have (docs/security/codegen.md, CG-1, CG-2 and K1-6): one
// unsigned compare for an `i64`, a `u32` or an `i32` (a negative one fails it),
// two float compares before the `fptosi` of an `f64`, and none for a literal.
// Under the default number mode the bound is 2^31 - 1; 2^62 bytes is refused.
export const test = (): number => {
  const wide: i64 = toI64(parseInt("3"));
  const a: f64[] = new Array<f64>(wide);
  const unsigned: u32 = toU32(parseInt("4"));
  const b: u8[] = new Array<u8>(unsigned);
  const float: f64 = toF64(parseInt("5"));
  const c: i32[] = new Array<i32>(float);
  const plain: i32[] = new Array<i32>(parseInt("6"));
  const literal: u8[] = new Array<u8>(7);
  console.log(`${a.length} ${b.length} ${c.length} ${plain.length} ${literal.length}`);
  return 0;
};
