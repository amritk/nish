// WP34 N5: `nish:net`. Each call is one call into runtime-net.c answering an
// `i32`; `netRead` checks its range in the IR first, through the slice panic,
// and the buffer it fills is `nocapture` but not `readonly`. `netWrite`'s is
// `readonly`. Neither is `willreturn`: a blocking socket the program inherited
// can wait.
import { netRead, netWrite, tcpListen } from "nish:net"

export const listen = (port: i32): i32 => tcpListen("::", port, 128)

export const echoOnce = (fd: i32, buf: u8[]): i32 => {
  const n = netRead(fd, buf, 0, buf.length)
  return n > 0 ? netWrite(fd, buf, 0, n) : n
}
