// `A` in `a.ts` is `B[]` and `B` here is `A | null`: an alias defined in terms
// of itself through another module, which is the cycle a local pair of aliases
// is, reported in the same words.
import { A } from "./a";

export type B = A | null;

export const main = (): number => {
  const b: B = null;
  return b === null ? 0 : 1;
};
