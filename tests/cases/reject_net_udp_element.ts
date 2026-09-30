// WP34 N5: `from` receives an address, which is bytes, so an i32[] is refused
// as it is for `netRead`'s buffer.
export const main = (): number => {
  const buf: u8[] = new Array<u8>(8);
  const from: i32[] = [0, 0, 0, 0, 0];
  const meta: i32[] = [0, 0];
  return udpRecvFrom(-1, buf, 0, 8, from, meta);
};
