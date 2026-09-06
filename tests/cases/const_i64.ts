// A bare literal takes the width of the constant it initialises, so the
// arithmetic here happens in 64 bits rather than overflowing i32.
const BILLION: i64 = 1000000000;
const BIG: i64 = BILLION * 10;

export function main(): number {
  console.log(BIG);
  return 0;
}
