// WP34 N5: `udpRecvFrom` writes the datagram into its buffer, so a readonly
// u8[] is refused there as a store through it is.
const take = (fd: i32, into: readonly u8[], from: u8[], meta: i32[]): i32 =>
  udpRecvFrom(fd, into, 0, 1, from, meta);

export const main = (): number => take(-1, [0], [0], [0, 0]);
