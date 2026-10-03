// `Http1Parser.feed` with a window outside its buffer panics (exit 1,
// "Http1Parser: the window is outside the buffer" on stderr) rather than
// parsing a short read: a request read from the wrong bytes looks exactly like
// one read from the right ones. Stdout stops at the line before the call.
import { Http1Parser } from "nish/net/http1";

export const main = (): i32 => {
  const p: Http1Parser = new Http1Parser(64, 512, 16, 1024);
  const data: u8[] = [71, 69, 84];
  const off: i32 = 2;
  const len: i32 = 2;
  console.log("feeding bytes 2 to 4 of a 3-byte array");
  p.feed(data, off, len);
  console.log("unreachable: the window was accepted");
  return 0;
};
