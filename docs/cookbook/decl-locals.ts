const polynomial = (x: number, k: number): number => {
  let acc: number = x * x * 3;
  acc = acc + k * 2;
  const bias = 7;
  return acc - bias;
};
