// --deterministic refuses `net` (NL3053): a peer answers from outside the program.
import { netAddress } from "nish:net";

export const main = (): number => {
  const out: u8[] = new Array<u8>(18);
  console.log(netAddress(out, "127.0.0.1", 8080));
  return 0;
};
