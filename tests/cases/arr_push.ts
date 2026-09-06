export function main(): number {
  const xs: number[] = [];
  for (let i = 0; i < 10; i++) {
    xs.push(i * i);
  }
  const n = xs.push(100);
  console.log(n);
  console.log(xs.length);
  for (let i = 0; i < xs.length; i++) {
    console.log(xs[i]);
  }
  return 0;
}
