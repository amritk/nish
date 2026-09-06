interface Pair {
  first: number;
  second: number;
}

function test(): number {
  const p: Pair = { first: 1 };
  return p.first;
}
