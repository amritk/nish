// WP34 N5: `udpSendTo` sends bytes from a u8[]; a string is not one, whatever
// TypeScript's `socket.send` would take.
export const main = (): number => {
  const to: u8[] = new Array<u8>(18);
  return udpSendTo(-1, "hello", 0, 5, to, 0, 0);
};
