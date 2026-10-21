// `tcpListenFlags`: flag 1 sets `SO_REUSEPORT` before the bind, so a second
// listener with it shares the first one's port, while a plain `tcpListen`, and
// `tcpListenFlags` with flag 0, on that port are refused with -98. A bit
// beyond flags 1 and 2 is -22, beside a defined one too, and so is a negative
// `flags`, read as unsigned.
import { netClose, netLocalPort, tcpListen, tcpListenFlags } from "nish:net";

export const main = (): number => {
  const a = tcpListenFlags("127.0.0.1", 0, 4, 1);
  const port = netLocalPort(a);
  const b = tcpListenFlags("127.0.0.1", port, 4, 1);
  console.log(a >= 0 && port > 0);
  console.log(b >= 0 && netLocalPort(b) === port);
  console.log(tcpListen("127.0.0.1", port, 4));
  console.log(tcpListenFlags("127.0.0.1", port, 4, 0));
  console.log(tcpListenFlags("127.0.0.1", 0, 4, 6));
  console.log(tcpListenFlags("127.0.0.1", 0, 4, 4));
  console.log(tcpListenFlags("127.0.0.1", 0, 4, -1));
  console.log(tcpListenFlags("nowhere", 0, 4, 1));
  netClose(b);
  return netClose(a);
};
