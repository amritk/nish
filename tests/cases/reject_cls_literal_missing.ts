interface Pair {
  first: number;
  second: number;
}

export const test = (): number => {
  const p: Pair = { first: 1 };
  return p.first;
};
