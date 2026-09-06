// Prefix and postfix ++/-- as statements and inside expressions, at the wrap boundary.
export function main(): number {
  let x = 5;
  const a = x++;
  const b = ++x;
  const c = x--;
  const d = --x;
  console.log(`${a} ${b} ${c} ${d} ${x}`);
  let m = 2147483647;
  m++;
  console.log(m);
  const old = m--;
  console.log(old);
  console.log(m);
  let n = -2147483647 - 1;
  n--;
  console.log(n);
  console.log(++n);
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
