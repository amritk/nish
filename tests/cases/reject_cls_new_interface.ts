interface Pair {
  first: number;
  second: number;
}

export function test(): number {
  const p = new Pair();
  return p.first;
}
