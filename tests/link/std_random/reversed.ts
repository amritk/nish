// `Rng.nextInt` with `lo` greater than `hi` asks for an empty range, which has
// no answer: after one roll it panics with its message and exits 1, natively
// and under Node.
import { Rng } from "nish/random";

export const main = (): i32 => {
  const r = new Rng(42);
  console.log(`${r.nextInt(1, 6)}`);
  console.log(`${r.nextInt(6, 1)}`);
  return 0;
};
