// `Http1Connection.write` with a window outside its buffer panics (exit 1,
// "Http1Connection.write: the window is outside the buffer" on stderr), before
// it looks at whether a response is under way: a body read from the wrong
// bytes would leak whatever lies past them. Stdout stops at the line before.
import { Http1Config, Http1Connection } from "nish/net/http1-server";

export const main = (): i32 => {
  const conn = new Http1Connection(new Http1Config());
  const body: u8[] = [104, 105];
  const off: i32 = 1;
  const len: i32 = 5;
  console.log("writing bytes 1 to 6 of a 2-byte array");
  conn.write(body, off, len);
  console.log("unreachable: the window was accepted");
  return 0;
};
