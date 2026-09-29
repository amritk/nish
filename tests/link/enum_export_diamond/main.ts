// One enum reached by two paths is one type: `left.ts` hands back the `Kind`
// it imported, `right.ts` takes the one it imported under another name, and
// `main.ts` passes the one to the other and compares it with its own import.
import { Kind } from "./base";
import { pick } from "./left";
import { isB } from "./right";

export const main = (): number => {
  const k = pick();
  console.log(isB(k) ? "B" : "A");
  return k === Kind.B ? 0 : 1;
};
