// Two imports of one local name: the one written first is the binding, and the
// second is the duplicate, named with the module the first came from.
import { Conn } from "./conn";
import { Conn } from "./wire";

export const main = (): number => {
  const c: Conn = 0;
  return c;
};
