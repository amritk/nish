// `Http1ResponseParser.feed` with a negative offset panics (exit 1, the same
// message on stderr) even when the window's end is inside the buffer: bytes
// before `data[0]` are not the response's.
import { Http1ResponseParser } from "nish/net/http1-client";

export const main = (): i32 => {
  const maxBody: i64 = 1024;
  const p: Http1ResponseParser = new Http1ResponseParser(64, 512, 16, maxBody, 128);
  const data: u8[] = [72, 84, 84];
  const off: i32 = -1;
  const len: i32 = 2;
  console.log("feeding bytes -1 to 1 of a 3-byte array");
  p.feed(data, off, len);
  console.log("unreachable: the window was accepted");
  return 0;
};
