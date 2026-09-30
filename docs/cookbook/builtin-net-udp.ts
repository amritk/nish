// WP34 N5: UDP in `nish:net`. `udpRecvFrom` checks its range in the IR first,
// through the slice panic, and every array it fills (the datagram, `from` and
// `meta`) is `nocapture` but not `readonly`; `udpSendTo`'s buffer and address
// are `readonly`. `udpBind` is `willreturn`, and neither of the other two is:
// a blocking socket the program inherited can wait.
import { udpBind, udpRecvFrom, udpSendTo } from "nish:net"

export const bind = (port: i32): i32 => udpBind("::", port, 2)

export const echoOnce = (fd: i32, buf: u8[], from: u8[], meta: i32[]): i32 => {
  const n = udpRecvFrom(fd, buf, 0, buf.length, from, meta)
  return n > 0 ? udpSendTo(fd, buf, 0, n, from, meta[0], meta[1]) : n
}
