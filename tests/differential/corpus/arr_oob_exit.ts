// An out-of-range index prints the earlier lines, then exits 1 (the message goes to stderr).
const at = (xs: number[], i: number): number => {
  return xs[i];
};

export const main = (): number => {
  const xs = [1, 2, 3];
  console.log(at(xs, 0));
  console.log(at(xs, 2));
  console.log("before");
  console.log(at(xs, 3));
  console.log("not printed");
  return 0;
};
