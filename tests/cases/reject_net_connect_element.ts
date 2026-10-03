// WP34 N5, #357: `tcpConnect` takes the 18-byte address `netAddress` writes,
// not the host string Node's `net.connect` would, because no name is resolved.
export const main = (): number => tcpConnect("127.0.0.1");
