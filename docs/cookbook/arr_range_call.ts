class Counts {
  v: i32[];
  calls: i32 = 0;

  constructor(n: i32) {
    this.v = new Array<i32>(n);
  }

  touch(): void {
    this.calls += 1;
  }

  bump(i: i32): void {
    this.v[i] = this.v[i] + 1;
  }

  fill(): void {
    for (let i = 0; i < this.v.length; i += 1) {
      this.touch();
      this.bump(i);
    }
  }
}

export const main = (): number => {
  const c = new Counts(4);
  c.fill();
  console.log(`${c.calls}`);
  return 0;
};
