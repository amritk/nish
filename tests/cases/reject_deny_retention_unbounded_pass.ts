// --deny-retention: NL9018, a loop that nothing bounds keeping what each pass
// allocates, is an error.
class Last {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
}

class Tally {
  last: Last;
  total: i32;
  open: boolean;
  constructor() {
    this.last = new Last(0);
    this.total = 0;
    this.open = true;
  }
}

export const main = (): void => {
  const tally = new Tally();
  let k = 0;
  while (tally.open) {
    const line = `line ${k}`;
    tally.total = tally.total + line.length;
    tally.last = new Last(k);
    k = k + 1;
    tally.open = k < 1000;
  }
  console.log(`${tally.total} ${tally.last.n}`);
};
