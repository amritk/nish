// WP34 N5: `nish:net` is a builtin module like `nish:fs`. An imported name, a
// renamed one included, is the same builtin as the global and lowers to the
// same call; `net_tcp_calls` reaches the globals.
import { netAddress as addressOf, netClose, tcpListen } from "nish:net";

export const main = (): number => {
  const out: u8[] = new Array<u8>(18);
  console.log(addressOf(out, "10.0.0.2", 53));
  console.log(`${out[10]} ${out[11]} ${out[12]} ${out[15]} ${out[17]}`);
  const fd = tcpListen("127.0.0.1", 0, 1);
  console.log(fd >= 0);
  return netClose(fd);
};
