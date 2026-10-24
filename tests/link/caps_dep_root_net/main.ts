// WP40: the root package's own reach needs no grant: `main` reaches `net`
// itself, and only the root's policy, which here allows everything, applies.
// The dependency it calls reaches nothing, so it is not blamed for `net`.
import { netAddress, tcpConnect } from "nish:net";
import { port } from "pkg_util";

const dial = (at: i32): boolean => {
  const addr: u8[] = [];
  return netAddress(addr, "127.0.0.1", at) >= 0 && tcpConnect(addr) >= 0;
};

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 && dial(port(1)) ? 1 : 0);
