// The entry is a second module so that the cross-module `declare` / `define`
// attribute check this directory runs has something to compare; the recursion
// the case is about is inside `sum.ts`.
import { sum } from "./sum";

export const main = (): number => {
  console.log(`${sum(1000000, 0)}`);
  return 0;
};
