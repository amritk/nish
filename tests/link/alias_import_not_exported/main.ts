// `conn.ts` declares `Conn` without `export`, so importing it is the
// not-exported mistake, in the words an unexported function, class or enum
// gets.
import { Conn, none } from "./conn";

export const main = (): number => {
  const c: Conn = none();
  return c === null ? 0 : 1;
};
