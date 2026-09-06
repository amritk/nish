interface Pair {
  first: number;
  second: number;
}

interface Tagged {
  tag: string;
  ok: boolean;
  pair: Pair;
}

function swap(p: Pair): Pair {
  return { first: p.second, second: p.first };
}

function describe(t: Tagged): number {
  if (t.ok) {
    console.log(t.tag);
  }
  return t.pair.first * 10 + t.pair.second;
}

export function main(): number {
  const p: Pair = { first: 1, second: 2 };
  const q = swap(p);
  console.log(q.first);
  const second = 9;
  const t: Tagged = { tag: "hello", ok: true, pair: { first: 4, second } };
  console.log(describe(t));
  t.pair = p;
  t.pair.first = 7;
  console.log(p.first);
  return 0;
}
