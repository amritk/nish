// `netResolve`, a host name to addresses through `getaddrinfo`. Each address
// is the 18-byte form `netAddress` writes and `tcpConnect` reads, so a lookup
// feeds a connect with nothing in between. It lowers to one call into
// runtime-net.c, `nounwind` alone: the lookup may wait on a resolver.
import { netResolve, tcpConnect } from "nish:net"

export const dial = (host: string, port: i32): i32 => {
  const addrs: u8[] = new Array<u8>(18)
  const n = netResolve(addrs, host, port, 0)
  return n < 1 ? n : tcpConnect(addrs)
}
