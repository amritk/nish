// WP40: a function argument is over-approximated. The root's own `dial`,
// passed to the dependency's template, makes `apply<dial>` reach `net`, and
// the instantiation is the dependency's: it is refused (NL2576) until the
// root grants `pkg_each` `net`, though only the root's code dials.
import { apply } from "pkg_each";
import { netAddress, tcpConnect } from "nish:net";

const dial = (port: i32): i32 => {
  const addr: u8[] = [];
  return netAddress(addr, "127.0.0.1", port) >= 0 && tcpConnect(addr) >= 0 ? 1 : 0;
};

export const main = (): i32 => (process.argv.length > 99 ? apply(dial, 1) : 0);
