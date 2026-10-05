// `netRead` checks its `(buf, off, len)` range against the buffer, and
// `nish:unsafe` has no unchecked form of it.
import { netRead } from "nish:net"

export const fill = (fd: i32, buf: u8[], off: i32, len: i32): i32 => netRead(fd, buf, off, len)
