import { twice } from "./helper";

// Two modules each declaring their own non-exported `add`. Since WP57 S1 each
// keeps it: a private function whose bare symbol another module's also takes
// is spelled with its module's qualifier, `@helper$.add` and `@main$.add`, so
// the whole-program attribute fixpoint, keyed by symbol, never sees one
// symbol for the two. `--no-strict-exports` still refuses the pair
// (`tests/link/module_private_no_strict`).
const add = (a: number, b: number): number => {
  return a + b;
};

export const main = (): number => {
  return add(twice(20), 2);
};
