function div(a: number, b: number): number {
  return a / b;
}

export function main(): number {
  let acc = 100;
  acc /= 7;
  acc %= 5;
  console.log(`${div(-7, 2)} ${div(7, -2)} ${-7 % 3} ${acc} ${div(-2147483648, 1)}`);
  return 0;
}
