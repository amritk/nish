// --number-mode f64: Math intrinsics with exactly representable results.
function roundAll(x: number): string {
  return `${x}: floor ${Math.floor(x)} ceil ${Math.ceil(x)} trunc ${Math.trunc(x)} round ${Math.round(x)}`;
}

export function main(): void {
  console.log(roundAll(2.5));
  console.log(roundAll(-2.5));
  console.log(roundAll(0.5));
  console.log(roundAll(-0.5));
  console.log(roundAll(1.5));
  console.log(roundAll(-1.5));
  console.log(roundAll(2.4999));
  console.log(roundAll(-2.4999));
  console.log(roundAll(0.49999999999999994));
  console.log(roundAll(-0.49999999999999994));
  console.log(roundAll(7));
  console.log(roundAll(-7));
  console.log(roundAll(1e15 + 0.5));
  console.log(roundAll(-1e15 - 0.5));
  console.log(roundAll(4503599627370497));
  console.log(Math.sqrt(16));
  console.log(Math.sqrt(2) * Math.sqrt(2));
  console.log(Math.sqrt(0.25));
  console.log(Math.pow(2, 10));
  console.log(Math.pow(2, -2));
  console.log(Math.pow(10, 15));
  console.log(Math.pow(-2, 3));
  console.log(Math.pow(0.5, 2));
  console.log(Math.exp(0));
  console.log(Math.log(1));
  console.log(Math.sin(0));
  console.log(Math.cos(0));
  console.log(Math.abs(-3.25));
  console.log(Math.abs(-0));
  console.log(Math.min(1.5, -2.5));
  console.log(Math.max(1.5, -2.5));
  console.log(Math.min(-0.0, 1));
  console.log(Math.PI);
  console.log(Math.E);
  console.log(Math.PI * 2);
  console.log(Math.floor(-0.1));
  console.log(Math.ceil(-0.9));
  console.log(Math.trunc(-0.9));
  let acc = 0;
  for (let i = 1; i <= 100; i++) {
    acc += Math.floor(i / 3) + Math.round(i / 7) - Math.ceil(i / 11);
  }
  console.log(acc);
}
