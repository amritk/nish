// WP34 N5: every `nish:net` answer a program can pin without a peer, through
// the globals. The address form of an IPv4 and an IPv6 literal, -22 for each
// bad argument (a name, which is not resolved, a literal with a NUL inside
// it, a short array, a port past 65535, a `how` past 2), -11 from an accept
// with nothing waiting, -98 from a second listener on a port in use, -9 from
// a closed descriptor, and a listener on `::`, which on a kernel without IPv6
// falls back to IPv4.
const bytes = (a: u8[]): string => {
  const parts: string[] = [];
  for (let i = 0; i < a.length; i++) {
    parts.push(`${a[i]}`);
  }
  return parts.join(" ");
};

export const main = (): number => {
  const out: u8[] = new Array<u8>(18);
  const short: u8[] = new Array<u8>(17);
  console.log(netAddress(out, "127.0.0.1", 8080));
  console.log(bytes(out));
  console.log(netAddress(out, "2001:db8::1", 443));
  console.log(bytes(out));
  console.log(netAddress(out, "localhost", 1));
  console.log(netAddress(out, "127.0.0.1\x00.9", 1));
  console.log(netAddress(short, "127.0.0.1", 1));
  console.log(netAddress(out, "127.0.0.1", 65536));
  console.log(tcpListen("nowhere", 0, 1));

  const fd = tcpListen("127.0.0.1", 0, 4);
  const port = netLocalPort(fd);
  console.log(fd >= 0 && port > 0);
  console.log(tcpListen("127.0.0.1", port, 4));
  console.log(tcpAccept(fd, out));
  console.log(tcpAccept(fd, short));
  console.log(netShutdown(fd, 3));
  console.log(netClose(fd));
  console.log(netClose(fd));
  console.log(netRead(fd, out, 0, 18));
  console.log(netWrite(fd, out, 0, 18));

  const both = tcpListen("::", 0, 4);
  console.log(both >= 0 && netLocalPort(both) > 0);
  return netClose(both);
};
