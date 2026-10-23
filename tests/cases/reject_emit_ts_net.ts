// WP33 R4: `nish:net` is refused under --emit-ts until its row lands, because
// a socket's translation reaches past the statement that makes it. The import
// is what is refused, so the whole module is, and nothing is written.
import { netAddress } from "nish:net";

export const main = (): number => {
  const out: u8[] = new Array<u8>(18);
  console.log(netAddress(out, "127.0.0.1", 8080));
  return 0;
};
