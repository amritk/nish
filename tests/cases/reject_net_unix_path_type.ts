// A Unix-domain path is a string, not the 18-byte address `tcpConnect` takes.
export const main = (): number => {
  const addr: u8[] = new Array<u8>(18);
  return unixConnect(addr);
};
