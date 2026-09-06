// --number-mode f64: division, remainder, and accumulation in doubles.
function mean(a: number, b: number, c: number): number {
  return (a + b + c) / 3;
}

export function main(): void {
  console.log(10 / 4);
  console.log(-10 / 4);
  console.log(1 / 3);
  console.log(5.5 % 2);
  console.log(-5.5 % 2);
  console.log(5.5 % -2);
  console.log(7 % 2.5);
  console.log(1e16 + 1);
  console.log(1e16 + 2);
  console.log(mean(1, 2, 3));
  console.log(mean(0.1, 0.2, 0.3));
  console.log(mean(1e308, 1e308, 1e308));
  let x = 1;
  for (let i = 0; i < 60; i++) {
    x *= 2;
  }
  console.log(x);
  console.log(x + 1);
  let y = 1;
  for (let i = 0; i < 1100; i++) {
    y /= 2;
  }
  console.log(y);
  let h = 0;
  for (let i = 1; i <= 1000; i++) {
    h += 1 / i;
  }
  console.log(h);
  let d = 1;
  let n = 0;
  while (d < 1e6) {
    d *= 3.5;
    n++;
  }
  console.log(`${n} ${d}`);
  const big = 123456789.123456789;
  console.log(big);
  console.log(big * big);
  console.log(big - 123456789);
  console.log(3 * 1.1);
  console.log(0.3 - 0.1);
  console.log(100 - 99.9);
  console.log(1 - 1e-17);
  console.log(1e308 * 10 - 1e308 * 10);
}
