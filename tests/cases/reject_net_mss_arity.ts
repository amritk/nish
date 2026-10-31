// `netMss` takes the descriptor alone: there is no direction or option to
// pass beside it.
import { netMss } from "nish:net";

export const mss = (fd: i32): i32 => netMss(fd, 1);
