// `websocketFrame` with a window outside its payload panics (exit 1,
// "websocketFrame: the window is outside the buffer" on stderr) rather than
// writing a length the frame does not carry. Stdout stops at the line before
// the call.
import { WS_OP_BINARY, websocketFrame } from "nish/net/websocket";

export const main = (): i32 => {
  const payload: u8[] = [1, 2, 3];
  const off: i32 = 1;
  const len: i32 = -1;
  console.log("a frame of length -1");
  const frame: u8[] | null = websocketFrame(true, WS_OP_BINARY, payload, off, len, null);
  console.log(`unreachable: ${frame === null ? "null" : "a frame"}`);
  return 0;
};
