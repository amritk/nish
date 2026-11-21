interface Pair {
  first: number;
  second: number;
}

export const test = (): number => {
  const p: Pair = { first: 1, second: 2, third: 3 };
  return p.first;
};
