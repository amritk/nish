// Literal edge values and the expressions that reach past them.
import { wrappingAdd, wrappingMul, wrappingSub } from "nish:unsafe";

export function main(): number {
  console.log(2147483647);
  console.log(-2147483647);
  console.log(-2147483647 - 1);
  console.log(0);
  console.log(-0);
  console.log(1000000000 * 2);
  console.log(wrappingMul(1000000000, 3));
  console.log(wrappingSub(2147483647, -1));
  console.log(wrappingAdd(-2147483647, -2));
  console.log(wrappingMul(65535, 65537));
  console.log(wrappingMul(65536, 32768));
  console.log(-65536 * 32768);
  console.log(wrappingAdd(1073741824, 1073741824));
  console.log(wrappingMul(1073741824, 2) / 2);
  console.log(wrappingAdd(2147483647, 1) / 2);
  console.log(wrappingAdd(2147483647, 1) % 3);
  console.log(wrappingSub(0, -2147483647 - 1));
  console.log(1 - 2 - 3 - 4);
  console.log(100 / 3 / 3);
  console.log(100 % 7 % 3);
  console.log(2 * 3 + 4 * 5 - 6 / 2 % 4);
  console.log((2 + 3) * (4 - 5) / (6 % 4));
  return 0;
}
