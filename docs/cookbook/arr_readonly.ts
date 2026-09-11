const sum = (xs: readonly number[]): number => {
  let total = 0;
  for (const x of xs) {
    total = total + x;
  }
  return total;
};

const sumMutable = (xs: number[]): number => {
  let total = 0;
  for (const x of xs) {
    total = total + x;
  }
  return total;
};
