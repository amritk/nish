// The listener the program opens twice: `tcpListen`'s socket with
// `SO_REUSEPORT`, so the second open on the first one's port shares it.
import { tcpListenFlags } from "nish:net";

/** A loopback listener on `port` (0: any) that shares the port with others like it. */
export const sharedListener = (port: i32, backlog: i32): i32 => tcpListenFlags("127.0.0.1", port, backlog, 1);
