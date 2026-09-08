interface Pair {
  first: number;
  second: number;
}

export function test(): number {
  const p: Pair = { first: 1 };
  return p.first;
}
