// Signed division truncates toward zero; the remainder takes the dividend's sign.
function div(a: number, b: number): number {
  return a / b;
}

function mod(a: number, b: number): number {
  return a % b;
}

export function main(): number {
  const min = -2147483647 - 1;
  console.log(div(7, 2));
  console.log(div(-7, 2));
  console.log(div(7, -2));
  console.log(div(-7, -2));
  console.log(mod(7, 3));
  console.log(mod(-7, 3));
  console.log(mod(7, -3));
  console.log(mod(-7, -3));
  console.log(div(min, 2));
  console.log(mod(min, 7));
  console.log(div(2147483647, -1));
  console.log(div(min, 1));
  console.log(mod(min, 2));
  console.log(div(1, 3));
  console.log(div(-1, 3));
  console.log(mod(-1, 3));
  console.log(div(0, 5));
  console.log(mod(0, -5));
  let x = 1000000000;
  x /= 7;
  console.log(x);
  x %= 1000;
  console.log(x);
  let y = -1000000000;
  y /= 7;
  console.log(y);
  y %= 1000;
  console.log(y);
  for (let a = -10; a <= 10; a += 5) {
    for (let b = -3; b <= 3; b += 2) {
      console.log(`${a} / ${b} = ${a / b}, ${a} % ${b} = ${a % b}`);
    }
  }
  return 0;
}
