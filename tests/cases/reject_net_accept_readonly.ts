// WP34 N5: `tcpAccept` writes the peer's address into its array, so a readonly
// u8[] is refused there too.
const next = (fd: i32, peer: readonly u8[]): i32 => tcpAccept(fd, peer);

export const main = (): number => next(-1, [0]);
