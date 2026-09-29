// A local declaration may not take a name an import already bound, whatever
// the import names: here a class clashes with an imported alias.
import { Conn } from "./conn";

class Conn {
  fd: i32 = 0;
}

export const main = (): number => new Conn().fd;
