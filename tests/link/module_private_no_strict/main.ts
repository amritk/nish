import { twice } from "./helper";

// Under `--no-strict-exports` every function is external and an external
// symbol is the name as written, so the two private `add`s are still one
// symbol, and refused (WP57 S1 qualifies nothing in that mode).
const add = (a: number, b: number): number => {
  return a + b;
};

export const main = (): number => {
  return add(twice(20), 2);
};
