// `Http1ResponseParser.feed` with a window outside its buffer panics (exit 1,
// "Http1ResponseParser: the window is outside the buffer" on stderr) rather
// than parsing a short read: a response read from the wrong bytes looks
// exactly like one read from the right ones. Stdout stops at the line before
// the call.
import { Http1ResponseParser } from "nish/net/http1-client";

export const main = (): i32 => {
  const maxBody: i64 = 1024;
  const p: Http1ResponseParser = new Http1ResponseParser(64, 512, 16, maxBody, 128);
  const data: u8[] = [72, 84, 84];
  const off: i32 = 2;
  const len: i32 = 2;
  console.log("feeding bytes 2 to 4 of a 3-byte array");
  p.feed(data, off, len);
  console.log("unreachable: the window was accepted");
  return 0;
};
