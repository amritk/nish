class Stats {
  total: number;
  scale: number;
  count: number = 0;

  constructor() {
    this.total = 0;
    this.scale = 8;
  }

  add(v: number): number {
    this.count += 1;
    this.total += v;
    return this.total;
  }
}

function halve(s: Stats): void {
  s.scale /= 2;
  s.total -= s.total % 2;
}

export function main(): number {
  const s = new Stats();
  s.add(5);
  s.add(8);
  s.total *= 3;
  halve(s);
  console.log(s.total);
  console.log(s.count);
  console.log(s.scale);
  return 0;
}
