interface Pair {
  first: number;
  second: number;
}

export const test = (): number => {
  const p = new Pair();
  return p.first;
};
