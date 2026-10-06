// `Http1Connection.feed` with a window outside its buffer panics (exit 1,
// "Http1Connection.feed: the window is outside the buffer" on stderr) rather
// than reading a short read: a carrier's off-by-one would otherwise become a
// request nobody sent. Stdout stops at the line before the call.
import { Http1Config, Http1Connection } from "nish/net/http1-server";

export const main = (): i32 => {
  const conn = new Http1Connection(new Http1Config());
  const data: u8[] = [71, 69, 84];
  const off: i32 = 2;
  const len: i32 = 2;
  console.log("feeding bytes 2 to 4 of a 3-byte array");
  conn.feed(data, off, len);
  console.log("unreachable: the window was accepted");
  return 0;
};
