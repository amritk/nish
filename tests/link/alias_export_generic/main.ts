// An imported alias of a generic class's instantiation is that instantiation:
// `main.ts` never names `Box`, and reads `b.value` as the `i32` it holds.
import { IntBox, wrap } from "./box";

const twice = (b: IntBox): i32 => b.value * 2;

export const main = (): number => {
  const b: IntBox = wrap(21);
  console.log(`${twice(b)}`);
  return twice(b) === 42 ? 0 : 1;
};
