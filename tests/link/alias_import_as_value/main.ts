// An alias is a type, not a value: `new Conn()` has no class called `Conn` to
// construct, only a type that names one.
import { Conn } from "./conn";

export const main = (): number => {
  const c = new Conn();
  return c.fd;
};
