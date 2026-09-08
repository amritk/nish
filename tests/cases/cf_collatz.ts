function collatzSteps(n: number): number {
  let steps = 0;
  let x = n;
  while (x !== 1) {
    if (x % 2 === 0) {
      x = x / 2;
    } else {
      x = 3 * x + 1;
    }
    steps++;
  }
  return steps;
}

export function test(): number {
  return collatzSteps(27);
}
