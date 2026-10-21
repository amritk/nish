// The listener the program opens twice: `tcpListen`'s socket with flags 1 and
// 2 together, so the second open shares the first one's port and every
// connection either accepts has `TCP_NODELAY` set.
import { tcpListenFlags } from "nish:net";

/** A loopback listener on `port` (0: any) that shares the port and turns Nagle off on what it accepts. */
export const quickListener = (port: i32, backlog: i32): i32 => tcpListenFlags("127.0.0.1", port, backlog, 3);
