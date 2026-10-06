// `Http1Connection.sendFrame` with a window outside its buffer panics (exit
// 1, "Http1Connection.sendFrame: the window is outside the buffer" on
// stderr), before it looks at the slot's state. Stdout stops at the line
// before the call.
import { Http1Config, Http1Connection } from "nish/net/http1-server";
import { WS_OP_BINARY } from "nish/net/websocket";

export const main = (): i32 => {
  const conn = new Http1Connection(new Http1Config());
  const payload: u8[] = [1, 2, 3];
  const off: i32 = -1;
  const len: i32 = 2;
  console.log("sending a frame from byte -1 of a 3-byte array");
  conn.sendFrame(true, WS_OP_BINARY, payload, off, len);
  console.log("unreachable: the window was accepted");
  return 0;
};
