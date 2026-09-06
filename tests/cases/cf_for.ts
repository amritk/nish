function factorial(n: number): number {
  let acc = 1;
  for (let i = 2; i <= n; i++) {
    acc = acc * i;
  }
  return acc;
}

function countEven(n: number): number {
  let c = 0;
  for (let i = 0; i < n; i += 2) c++;
  return c;
}

function test(): number {
  return factorial(6) + countEven(9);
}
