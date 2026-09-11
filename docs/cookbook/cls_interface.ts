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

const swap = (p: Pair): Pair => ({ first: p.second, second: p.first });

const asPair = (o: Ordered): Pair => o;
