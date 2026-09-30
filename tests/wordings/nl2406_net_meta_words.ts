// NL2406: `udpRecvFrom`'s `meta` is an i32[], the one `nish:net` argument
// that holds numbers rather than bytes.
export const main = (): i32 => {
  const buf: u8[] = new Array<u8>(4);
  const from: u8[] = new Array<u8>(18);
  const meta: f64[] = [0, 0];
  return udpRecvFrom(-1, buf, 0, 4, from, meta);
};
