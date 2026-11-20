import { fromShared } from "../module_private_shared/u";

// A module outside the entry's directory keeps its `..` steps in its
// qualifier, so `../module_private_shared/u.ts`'s private `helper` is
// `@___module_private_shared_u$.helper` however the entry is named, and no
// machine's directory reaches the symbol (WP57 S1).
const helper = (n: number): number => {
  return n + 1;
};

export const main = (): number => {
  return helper(fromShared(5));
};
