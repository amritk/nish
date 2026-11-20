import { helper as triple } from "./lib";

// A private `helper` beside another module's exported one: the exported
// symbol never moves, so lib.ts keeps `@helper` and this one is
// `@main$.helper` (WP57 S1).
const helper = (n: number): number => {
  return n + 1;
};

export const main = (): number => {
  return helper(triple(4));
};
