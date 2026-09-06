interface Pair {
  first: number;
  second: number;
}

class Ordered implements Pair {
  first: number;
  second: number;

  constructor(a: number, b: number) {
    this.first = a;
    this.second = b;
  }
}

function swap(p: Pair): Pair {
  return { first: p.second, second: p.first };
}

function asPair(o: Ordered): Pair {
  return o;
}
