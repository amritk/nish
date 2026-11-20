import { fromA } from "./a";
import { fromB } from "./b";

// Two private generics of one name: each module's instantiations carry its
// qualifier, `@a$.identity$i32` and `@b$.identity$i32` (WP57 S1).
export const main = (): number => {
  return fromA(2) + fromB(3);
};
