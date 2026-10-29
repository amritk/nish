// `netResolve`'s refusals and failures. A `.invalid` name is no such name
// (-1001), never a resolver's answer (RFC 6761), and so is one of exactly 253
// bytes: the limit lets it reach `getaddrinfo`. One byte longer, an empty host
// and a host with a NUL inside are -22 before libc sees them, as are a family
// other than 0, 4 and 6, a port outside 0..65535 and an `out` shorter than one
// address. The lookup writes nothing when it fails.
import { netResolve } from "nish:net";

export const main = (): number => {
  const out: u8[] = new Array<u8>(18);
  const short: u8[] = new Array<u8>(17);
  console.log(netResolve(out, "nish-test.invalid", 80, 0));
  console.log(netResolve(out, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.invalid", 80, 0));
  console.log(netResolve(out, "caaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.invalid", 80, 0));
  console.log(netResolve(out, "", 80, 0));
  console.log(netResolve(out, "localhost\x00.invalid", 80, 0));
  console.log(netResolve(out, "localhost", 80, 5));
  console.log(netResolve(out, "localhost", 80, -1));
  console.log(netResolve(out, "localhost", 65536, 0));
  console.log(netResolve(out, "localhost", -1, 0));
  console.log(netResolve(short, "localhost", 80, 0));
  console.log(`${out[0]} ${out[10]} ${out[17]}`);
  return 0;
};
