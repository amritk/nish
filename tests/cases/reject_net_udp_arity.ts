// WP34 N5: `udpSendTo` takes its segment size and its ECN bits every time;
// there are no optional arguments.
export const main = (): number => {
  const buf: u8[] = new Array<u8>(8);
  const to: u8[] = new Array<u8>(18);
  return udpSendTo(-1, buf, 0, 8, to);
};
