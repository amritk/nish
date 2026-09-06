interface Pair {
  first: number;
  second: number;
}

function test(): number {
  const p: Pair = { first: 1, second: 2, third: 3 };
  return p.first;
}
