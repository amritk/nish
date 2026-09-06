// A negative index fails the unsigned bounds compare: prints, then exits 1.
export function main(): number {
  const xs = [1, 2, 3];
  let i = 2;
  while (i >= 0) {
    console.log(xs[i]);
    i--;
  }
  console.log("about to fail");
  xs[i] = 5;
  console.log("not printed");
  return 0;
}
