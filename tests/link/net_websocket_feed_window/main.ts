// `WsDecoder.feed` with a window outside its buffer panics (exit 1,
// "WsDecoder: the window is outside the buffer" on stderr) rather than
// decoding a short read. Stdout stops at the line before the call.
import { WsDecoder } from "nish/net/websocket";

export const main = (): i32 => {
  const d: WsDecoder = new WsDecoder(true, 1024);
  const data: u8[] = [129, 0];
  const off: i32 = 0;
  const len: i32 = 3;
  console.log("feeding 3 bytes of a 2-byte array");
  d.feed(data, off, len);
  console.log("unreachable: the window was accepted");
  return 0;
};
