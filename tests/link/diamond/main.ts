import { twice } from "./b";
import { thrice } from "./c";

// b and c both import d; d must be parsed and defined exactly once.
// Exit code: 5 * 2 + 5 * 3 = 25.
export const main = (): number => {
  return twice() + thrice();
};
