const squares = (n: number): number[] => {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(i * i);
  }
  return xs;
};

const pair = (): number[] => [1, 2];
