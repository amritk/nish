const LIMIT: i32 = 10;
const STEP: i32 = LIMIT / 4;
const WRAPPED: i32 = 2147483647 + 1;
const LABEL: string = "step " + "size";
const ENABLED: boolean = LIMIT > 5;
const RATIO: f64 = 1.0 / 4.0;
const BIG: i64 = 4000000000;

export function main(): number {
  console.log(LABEL);
  console.log(WRAPPED);
  console.log(RATIO);
  console.log(BIG);
  let total = 0;
  if (ENABLED) {
    for (let i = 0; i < LIMIT; i = i + STEP) {
      total = total + i;
    }
  }
  console.log(total);
  return STEP;
}
