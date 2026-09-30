// WP34 N5: `udpSendTo` and `udpRecvFrom` check `0 <= off <= off + len <=
// buf.length` before the call, as `netRead` and `netWrite` do, through the
// slice panic `set` uses and with its words. In range, the call reaches the
// runtime, which answers -9 for the closed descriptor; `net_udp_bounds.c`
// runs each range that is not in a child and prints its message and its exit
// status.
const sendAt = (off: i32, len: i32): i32 => {
  const buf: u8[] = [1, 2, 3, 4, 5, 6, 7, 8];
  const to: u8[] = new Array<u8>(18);
  return udpSendTo(-1, buf, off, len, to, 0, 0);
};

const receiveAt = (off: i32, len: i32): i32 => {
  const buf: u8[] = new Array<u8>(8);
  const from: u8[] = new Array<u8>(18);
  const meta: i32[] = [0, 0];
  return udpRecvFrom(-1, buf, off, len, from, meta);
};

export const pastEnd = (): i32 => sendAt(6, 3);

export const negativeOffset = (): i32 => receiveAt(-2, 4);

export const negativeLength = (): i32 => sendAt(3, -1);

export const test = (): i32 => sendAt(0, 8) + receiveAt(8, 0);
