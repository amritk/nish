// WP34 N5: `udpRecvFrom` writes the segment size and the ECN bits into
// `meta`, so a readonly i32[] is refused there too.
const take = (fd: i32, into: u8[], from: u8[], meta: readonly i32[]): i32 =>
  udpRecvFrom(fd, into, 0, 1, from, meta);

export const main = (): number => take(-1, [0], [0], [0, 0]);
