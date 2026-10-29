// `Http1ResponseParser.feed` with a negative length panics (exit 1, the same
// message on stderr) rather than moving the parser's end of input backwards
// over bytes it already holds.
import { Http1ResponseParser } from "nish/net/http1-client";

export const main = (): i32 => {
  const maxBody: i64 = 1024;
  const p: Http1ResponseParser = new Http1ResponseParser(64, 512, 16, maxBody, 128);
  const data: u8[] = [72, 84, 84];
  const off: i32 = 1;
  const len: i32 = -1;
  console.log("feeding -1 bytes from byte 1 of a 3-byte array");
  p.feed(data, off, len);
  console.log("unreachable: the window was accepted");
  return 0;
};
