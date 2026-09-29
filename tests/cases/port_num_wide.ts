// WP33 NL8009: an i64 or u64 is 64 bits here and a double in TypeScript, which
// rounds past 2^53. Each declaration is reported once, however often it is
// used: a module constant, a field, a parameter, a return type, a local with
// or without an annotation, and a `for...of` binding.
const LIMIT: i64 = 1000;

class Ledger {
  total: i64;

  constructor() {
    this.total = 0;
  }
}

const scale = (n: u64): i64 => toI64(n) * 3;

export const main = (): number => {
  const ledger = new Ledger();
  const step: i64 = 2;
  const counted = toI64(5);
  const steps: i64[] = [step, counted, LIMIT];
  for (const s of steps) {
    ledger.total = ledger.total + s + scale(toU64(1));
  }
  console.log(toI32(ledger.total));
  console.log(toI32(step + counted));
  return 0;
};
