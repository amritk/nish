// f64 constants fold in IEEE-754 and are emitted as the bit pattern, which is
// the only form LLVM accepts for every double.
const HALF: f64 = 0.5;
const QUARTER: f64 = HALF * HALF;

export function main(): number {
  console.log(QUARTER);
  return 0;
}
