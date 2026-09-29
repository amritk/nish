// `main.ts` never imports `Socket`: `Conn` is all it names, and a `Conn`
// narrowed by `=== null` is a `Socket` whose field it reads.
import { Conn, open } from "./conn";

const describe = (c: Conn): string => (c === null ? "closed" : `fd ${c.fd}`);

export const main = (): number => {
  const conns: Conn[] = [open(3), open(-1), open(7)];
  let total = 0;
  for (const c of conns) {
    console.log(describe(c));
    if (c !== null) {
      total = total + c.fd;
    }
  }
  return total === 10 ? 0 : 1;
};
