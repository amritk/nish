// WP35: every `nish:net` export is `net`, imported here by name rather than
// reached as a global, so the witness names the builtin the import renames.
// `netAddress` only writes a socket address into a buffer, so the round trip
// needs no network; it is the label that is the point, not the socket.
import { netAddress } from "nish:net";

const encode = (out: u8[]): i32 => netAddress(out, "127.0.0.1", 8080);

export const main = (): number => {
  const out: u8[] = new Array<u8>(18);
  console.log(encode(out));
  return 0;
};
