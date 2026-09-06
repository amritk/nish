interface Pair {
  first: number;
  second: number;
}

function test(): number {
  const p = new Pair();
  return p.first;
}
