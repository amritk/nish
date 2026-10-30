// Every `nish:net` Unix-domain answer a program can pin in the abstract
// namespace, which leaves no file behind: a listener, a connection it waits
// for through the poll loop and accepts, bytes both ways, a half close the peer
// reads as 0, and -11 from an accept with nothing waiting. Then the pair: a
// stream pair and a seqpacket pair, whose reads keep each message's boundary.
// Then the refusals: -22 for an empty path, a bare "@", a NUL inside, a flags
// word past 1, an unknown pair kind and a pair array shorter than 2; -36 for a
// name past `sun_path`; -98 for a second listener on a name in use; -111 from
// a connect to a name nobody listens on; -22 from `unixListenMode` on an
// abstract name, which has no file to give a mode to.
import {
  NET_UNIX_SEQPACKET,
  NET_UNIX_STREAM,
  netClose,
  netRead,
  netShutdown,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  unixAccept,
  unixConnect,
  unixListen,
  unixListenMode,
  unixSocketPair,
} from "nish:net";

const NAME: string = "@nish-net-unix-calls";

/** The bytes of `s`, one per character. */
const bytesOf = (s: string): u8[] => {
  const out: u8[] = new Array<u8>(s.length);
  for (let i = 0; i < out.length && i < s.length; i++) {
    out[i] = toU8(s.charCodeAt(i));
  }
  return out;
};

/** "@" and then `n` letters, an abstract name of `n + 1` bytes. */
const abstract = (n: i32): string => {
  const parts: string[] = ["@"];
  for (let i = 0; i < n; i++) {
    parts.push("n");
  }
  return parts.join("");
};

/** `buf[0, n)` as a string, or the failure `n` is. */
const text = (buf: u8[], n: i32): string => {
  if (n < 0) {
    return `${n}`;
  }
  const parts: string[] = [];
  for (let i = 0; i < n && i < buf.length; i++) {
    parts.push(String.fromCharCode(buf[i]));
  }
  return parts.join("");
};

/** One message, sent whole, to `fd`. */
const send = (fd: i32, s: string): i32 => {
  const b = bytesOf(s);
  return netWrite(fd, b, 0, b.length);
};

export const main = (): number => {
  const buf: u8[] = new Array<u8>(64);

  const listener = unixListen(NAME, 4, 0);
  console.log(listener >= 0);
  console.log(unixAccept(listener));
  const client = unixConnect(NAME);
  console.log(client >= 0);
  const loop = pollCreate();
  pollAdd(loop, listener, 1, 0);
  const ready: i32[] = new Array<i32>(2);
  const conn = pollWait(loop, ready, 2000) === 1 ? unixAccept(listener) : -110;
  console.log(conn >= 0);
  console.log(send(client, "ping"));
  pollAdd(loop, conn, 1, 1);
  console.log(pollWait(loop, ready, 2000));
  console.log(text(buf, netRead(conn, buf, 0, 64)));
  console.log(send(conn, "pong"));
  console.log(netShutdown(conn, 1));
  pollAdd(loop, client, 1, 2);
  console.log(pollWait(loop, ready, 2000) >= 1);
  console.log(text(buf, netRead(client, buf, 0, 64)));
  console.log(netRead(client, buf, 0, 64));
  console.log(unixListen(NAME, 4, 0));
  netClose(loop);
  netClose(conn);
  netClose(client);
  netClose(listener);

  const pair: i32[] = new Array<i32>(2);
  console.log(unixSocketPair(NET_UNIX_STREAM, pair));
  console.log(send(pair[0], "ab"));
  console.log(send(pair[0], "cd"));
  console.log(text(buf, netRead(pair[1], buf, 0, 64)));
  netClose(pair[0]);
  console.log(netRead(pair[1], buf, 0, 64));
  netClose(pair[1]);

  console.log(unixSocketPair(NET_UNIX_SEQPACKET, pair));
  console.log(send(pair[0], "ab"));
  console.log(send(pair[0], "cd"));
  console.log(text(buf, netRead(pair[1], buf, 0, 64)));
  console.log(text(buf, netRead(pair[1], buf, 0, 64)));
  console.log(netRead(pair[1], buf, 0, 64));
  netClose(pair[0]);
  netClose(pair[1]);

  console.log(unixListen("", 4, 0));
  console.log(unixListen("@", 4, 0));
  console.log(unixListen("@a\x00b", 4, 0));
  console.log(unixListen(NAME, 4, 2));
  console.log(unixSocketPair(3, pair));
  console.log(unixSocketPair(0, pair));
  console.log(unixSocketPair(NET_UNIX_STREAM, new Array<i32>(1)));
  console.log(unixListen(abstract(107), 4, 0) >= 0);
  console.log(unixListen(abstract(108), 4, 0));
  console.log(unixConnect(abstract(108)));
  console.log(unixConnect("@nish-net-unix-nobody"));
  console.log(unixListenMode(NAME, 4, 0, 0o600));
  console.log(unixListenMode("build/test/x.sock", 4, 0, 0o1000));
  return 0;
};
