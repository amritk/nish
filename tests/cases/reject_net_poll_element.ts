// WP34 N5: `ready` holds tokens, which are the program's own `i32`s, so it is
// an i32[], as `udpRecvFrom`'s `meta` is, and not a u8[].
export const main = (): number => {
  const ready: u8[] = [0, 0];
  return pollWait(-1, ready, 0);
};
