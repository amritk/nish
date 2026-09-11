const square = (x: number): number => x * x;

const polynomial = (x: number, k: number): number => {
  let acc: number = square(x) * 3;
  acc = acc + k * 2;
  const bias = 7;
  return acc - bias;
};

const isPositive = (n: number): boolean => n > 0;
