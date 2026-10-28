// Prefix and postfix ++/-- as statements and inside expressions; the steps
// across the wrap boundary are the `nish:unsafe` calls that ask for the wrap.
import { wrappingAdd, wrappingSub } from "nish:unsafe";

export function main(): number {
  let x = 5;
  const a = x++;
  const b = ++x;
  const c = x--;
  const d = --x;
  console.log(`${a} ${b} ${c} ${d} ${x}`);
  let m = 2147483647;
  m = wrappingAdd(m, 1);
  console.log(m);
  const old = m;
  m = wrappingSub(m, 1);
  console.log(old);
  console.log(m);
  let n = -2147483647 - 1;
  n = wrappingSub(n, 1);
  console.log(n);
  n = wrappingAdd(n, 1);
  console.log(n);
  let i = 0;
  let sum = 0;
  while (i++ < 10) {
    sum += i;
  }
  console.log(sum);
  console.log(i);
  let j = 10;
  let steps = 0;
  while (--j > 0) {
    steps++;
  }
  console.log(steps);
  console.log(j);
  let k = 3;
  const v = k++ * k++;
  console.log(v);
  console.log(k);
  const w = ++k * ++k;
  console.log(w);
  console.log(k);
  return 0;
}
