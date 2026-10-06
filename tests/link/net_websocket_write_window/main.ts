// `websocketWriteFrame` with a payload window outside its buffer panics (exit
// 1, "websocketWriteFrame: the window is outside the buffer" on stderr)
// rather than framing bytes it was not given. Stdout stops at the line before
// the call.
import { WS_OP_TEXT, websocketWriteFrame } from "nish/net/websocket";

export const main = (): i32 => {
  const out: u8[] = new Array<u8>(64);
  const payload: u8[] = [72, 105];
  const at: i32 = 0;
  const off: i32 = 1;
  const len: i32 = 2;
  console.log("framing bytes 1 to 3 of a 2-byte array");
  websocketWriteFrame(out, at, true, WS_OP_TEXT, payload, off, len, null);
  console.log("unreachable: the window was accepted");
  return 0;
};
