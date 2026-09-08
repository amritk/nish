// i64: a 64-bit multiply whose result overflows i32, printed through console.log
// (amrit_str_from_i64) and a template literal. Literals take the i64 type from
// context: the annotated initializer, the parameter, and the other operand.
//
// Compiled with `--wrapping` (see .args) because `sq * 2` overflows i64 and the
// `.out` pins the wrapped answer; under the default that multiply carries `nsw`
// and the program would be relying on undefined behaviour.
function square(x: i64): i64 {
  return x * x;
}

export function test(): number {
  const big: i64 = 3000000000;
  const sq = square(big);
  console.log(sq);
  console.log(`${big} * 2 = ${big * 2}`);
  console.log(big > 5);
  console.log(-big);
  console.log(sq * 2);
  const n: number = 7;
  console.log(toI64(n) + 1);
  return toI32(sq % 1000);
}
