// WP34 N5: each `nish:net` function takes exactly its parameters; there is no
// optional backlog.
export const main = (): number => tcpListen("127.0.0.1", 0);
