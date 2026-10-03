// WP34 N5, #357: `tcpConnect` and `connectResult` imported from `nish:net`, one
// of them renamed, are the same builtins as the globals `net_tcp_connect`
// reaches. -22 for an address shorter than 18 bytes, before any socket
// exists, and -9 for a descriptor that is not one.
import { connectResult, tcpConnect as connectTo } from "nish:net";

export const main = (): number => {
  const short: u8[] = new Array<u8>(17);
  console.log(connectTo(short));
  console.log(connectResult(-1));
  return 0;
};
