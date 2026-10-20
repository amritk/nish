// WP34 N5: `tcpListenFlags`, `tcpListen` with a flags word. Flag 1 is
// `SO_REUSEPORT`, so a second listener can take the first one's port. It lowers
// to one call into runtime-net.c, `nounwind willreturn` as `tcpListen`'s is:
// making, configuring and binding a socket never waits. The flags are checked
// there, not in the IR, since they are a runtime value.
import { netLocalPort, tcpListenFlags } from "nish:net"

export const shared = (port: i32, backlog: i32): i32 => tcpListenFlags("0.0.0.0", port, backlog, 1)

export const beside = (fd: i32, backlog: i32): i32 => shared(netLocalPort(fd), backlog)
