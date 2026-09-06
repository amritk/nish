function first(xs: number[]): number {
  return xs[0];
}

export function main(): number {
  const xs = [10, 20, 30];
  console.log(xs.length);
  console.log(first(xs));
  console.log(xs[2]);
  const flags = [true, false];
  console.log(flags[1]);
  return 0;
}
