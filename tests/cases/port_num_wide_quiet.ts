// WP33 NL8009, quiet: i32 and f64 declarations are what a double holds exactly.
const LIMIT: i32 = 1000;

class Ledger {
  total: f64;

  constructor() {
    this.total = 0;
  }
}

const scale = (n: i32): f64 => toF64(n) * 1.5;

export const main = (): number => {
  const ledger = new Ledger();
  const step: i32 = 2;
  for (const s of [step, LIMIT]) {
    ledger.total = ledger.total + scale(s);
  }
  console.log(`${ledger.total}`);
  return 0;
};
