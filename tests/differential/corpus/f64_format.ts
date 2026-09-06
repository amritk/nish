// --number-mode f64: every value must print exactly as JavaScript's String(x).
function nan(): number {
  const z = 0;
  return z / z;
}

export function main(): void {
  console.log(0.1 + 0.2);
  console.log(1e21);
  console.log(1e-7);
  console.log(0.000001);
  console.log(Math.pow(2, 53));
  console.log(Math.pow(2, 53) + 1);
  console.log(Math.pow(2, 53) + 2);
  console.log(-0);
  const negZero = -1 * 0;
  console.log(negZero);
  console.log(`neg zero: ${negZero}`);
  console.log(1 / 3);
  console.log(2 / 3);
  console.log(100);
  console.log(1.5);
  console.log(-2.5);
  console.log(123456789012);
  console.log(5e-324);
  console.log(1.7976931348623157e308);
  console.log(1e300 * 1e10);
  console.log(-1e300 * 1e10);
  console.log(nan());
  console.log(1e20);
  console.log(1e21 - 1);
  console.log(123e-20);
  console.log(4.35);
  console.log(0.1 * 3);
  console.log(1 / 7);
  console.log(3.14159);
  console.log(2.5e-7);
  console.log(1.5e300);
  console.log(9007199254740993);
  console.log(0.5);
  console.log(-0.5);
  let x = 0;
  for (let i = 0; i < 10; i++) {
    x += 0.1;
  }
  console.log(x);
  console.log(x === 1);
  console.log(1e15 + 0.3);
  console.log(1e16 + 1);
  console.log(`${1e21} ${1e-7} ${-0} ${nan()} ${1 / 3}`);
}
