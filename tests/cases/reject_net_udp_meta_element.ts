// WP34 N5: `meta` holds numbers, a segment size up to 65,535 among them, so
// it is an i32[] and not the u8[] every other buffer of `nish:net` is.
export const main = (): number => {
  const buf: u8[] = new Array<u8>(8);
  const from: u8[] = new Array<u8>(18);
  const meta: u8[] = [0, 0];
  return udpRecvFrom(-1, buf, 0, 8, from, meta);
};
