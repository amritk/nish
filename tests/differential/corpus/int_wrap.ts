// i32 wrapping at the 2^31 boundary: add, sub, mul, negation, loops, each
// written as the `nish:unsafe` call that asks for the wrap.
import { wrappingAdd, wrappingMul, wrappingSub } from "nish:unsafe";

function times(a: number, b: number): number {
  return wrappingMul(a, b);
}

export function main(): number {
  const max = 2147483647;
  const min = -2147483647 - 1;
  console.log(wrappingAdd(max, 1));
  console.log(wrappingSub(min, 1));
  console.log(wrappingMul(max, 2));
  console.log(wrappingMul(min, -1));
  console.log(wrappingSub(0, min));
  console.log(times(65536, 65536));
  console.log(times(46341, 46341));
  console.log(times(46340, 46340));
  console.log(times(-46341, 46341));
  console.log(times(123456789, 987654321));
  console.log(wrappingAdd(max, max));
  console.log(wrappingAdd(min, min));
  let acc = 1;
  for (let i = 0; i < 40; i++) {
    acc = wrappingAdd(wrappingMul(acc, 3), 1);
  }
  console.log(acc);
  let p = 1;
  for (let i = 1; i <= 20; i++) {
    p = wrappingMul(p, i);
    console.log(`${i}! = ${p}`);
  }
  let s = 0;
  for (let i = 0; i < 100000; i++) {
    s = wrappingAdd(s, wrappingMul(i, i));
  }
  console.log(s);
  return 0;
}
