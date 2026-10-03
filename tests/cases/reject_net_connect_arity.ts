// WP34 N5, #357: the port is inside the address, so `tcpConnect` takes the
// address alone and not Node's `(port, host)`.
export const main = (): number => {
  const addr: u8[] = new Array<u8>(18);
  return tcpConnect(addr, 80);
};
