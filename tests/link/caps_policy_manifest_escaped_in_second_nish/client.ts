import { netAddress, tcpConnect } from "nish:net";

export const dial = (port: i32): boolean => {
  const addr: u8[] = [];
  return netAddress(addr, "127.0.0.1", port) >= 0 && tcpConnect(addr) >= 0;
};
