// `websocketFrame` with a window outside its payload answers null rather than
// panicking or writing a length the frame does not carry (#2137): the program
// runs on to the end and exits 0. A length past 2^31 - 15 is refused the same
// way, as is `websocketFrameSize` of a negative length.
import { WS_OP_BINARY, WS_REFUSED, websocketFrame, websocketFrameSize } from "nish/net/websocket";

export const main = (): i32 => {
  const payload: u8[] = [1, 2, 3];
  const off: i32 = 1;
  const len: i32 = -1;
  console.log("a frame of length -1");
  const frame: u8[] | null = websocketFrame(true, WS_OP_BINARY, payload, off, len, null);
  console.log(`refused: ${frame === null ? "null" : "a frame"}`);
  const past: u8[] | null = websocketFrame(true, WS_OP_BINARY, payload, off, 3, null);
  console.log(`bytes 1 to 4 of 3: ${past === null ? "null" : "a frame"}`);
  console.log(`size of -1: ${websocketFrameSize(len, false) === WS_REFUSED ? "WS_REFUSED" : "a size"}`);
  const whole: u8[] | null = websocketFrame(true, WS_OP_BINARY, payload, off, 2, null);
  console.log(`bytes 1 to 3: ${whole === null ? "null" : `${whole.length} bytes`}`);
  return 0;
};
