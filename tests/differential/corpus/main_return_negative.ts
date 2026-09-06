// A negative return from main wraps to an 8-bit exit status (-1 -> 255).
export function main(): number {
  const xs = new Array<number>(0);
  console.log(xs.length);
  xs.push(-1);
  console.log(xs.length);
  console.log(xs[0]);
  const ys: string[] = [];
  console.log(ys.length);
  for (const y of ys) {
    console.log(y);
  }
  return xs[0];
}
