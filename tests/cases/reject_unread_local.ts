// A local that is computed and never read is a value the program forgot to
// use: here `total` was meant to be returned (src/hygiene.ts, NL2712).
const sum = (xs: i32[]): i32 => {
  let total: i32 = 0;
  for (const x of xs) {
    total = total + x;
  }
  const doubled = total * 2;
  return total;
};

export const main = (): i32 => {
  console.log(`${sum([1, 2, 3])}`);
  return 0;
};
