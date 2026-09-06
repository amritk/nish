export function main(): number {
  const n = 4;
  const xs = new Array<number>(n);
  console.log(xs.length);
  for (let i = 0; i < xs.length; i++) {
    console.log(xs[i]);
  }
  const flags = new Array<boolean>(2);
  console.log(flags[0]);
  return 0;
}
