// NL2556: A class imported from another module, `nish/random`'s `Rng`, is refused as a local one is. A class with methods is made only by `new`.
import { Rng } from "nish/random";
export const main = (): i32 => {
  const r: Rng = { state: 5 };
  return r.nextI32();
};
