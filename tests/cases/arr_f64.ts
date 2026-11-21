const mean = (xs: number[]): number => {
  let total = 0;
  for (const x of xs) {
    total += x;
  }
  return total / xs.length;
};

export const main = (): void => {
  const xs = [1.5, 2.5, 5];
  console.log(mean(xs));
  console.log(xs[1]);
};
