// `netWrite2`: two buffers in one `sendmsg`. Each range is checked in the IR
// first, `a`'s then `b`'s, through the slice panic `netWrite` uses; both
// buffers are `readonly` and `nocapture`, and the call is not `willreturn`.
import { netWrite2 } from "nish:net"

export const sendFramed = (fd: i32, head: readonly u8[], body: readonly u8[]): i32 =>
  netWrite2(fd, head, 0, head.length, body, 0, body.length)
