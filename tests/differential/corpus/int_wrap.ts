// i32 wrapping at the 2^31 boundary: add, sub, mul, unary minus, loops.
function times(a: number, b: number): number {
  return a * b;
}

export function main(): number {
  const max = 2147483647;
  const min = -2147483647 - 1;
  console.log(max + 1);
  console.log(min - 1);
  console.log(max * 2);
  console.log(min * -1);
  console.log(-min);
  console.log(times(65536, 65536));
  console.log(times(46341, 46341));
  console.log(times(46340, 46340));
  console.log(times(-46341, 46341));
  console.log(times(123456789, 987654321));
  console.log(max + max);
  console.log(min + min);
  let acc = 1;
  for (let i = 0; i < 40; i++) {
    acc = acc * 3 + 1;
  }
  console.log(acc);
  let p = 1;
  for (let i = 1; i <= 20; i++) {
    p *= i;
    console.log(`${i}! = ${p}`);
  }
  let s = 0;
  for (let i = 0; i < 100000; i++) {
    s += i * i;
  }
  console.log(s);
  return 0;
}
