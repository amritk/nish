// `websocketWriteFrame` with a payload window outside its buffer answers
// `WS_REFUSED` and leaves `out` untouched, rather than panicking or framing
// bytes it was not given (#2137): the program runs on to the end and exits 0.
import { WS_OP_TEXT, WS_REFUSED, websocketWriteFrame } from "nish/net/websocket";

export const main = (): i32 => {
  const out: u8[] = new Array<u8>(64);
  const payload: u8[] = [72, 105];
  const at: i32 = 0;
  const off: i32 = 1;
  const len: i32 = 2;
  console.log("framing bytes 1 to 3 of a 2-byte array");
  const end: i32 = websocketWriteFrame(out, at, true, WS_OP_TEXT, payload, off, len, null);
  console.log(`refused: ${end === WS_REFUSED ? "WS_REFUSED" : `${end}`}, out[0] still ${out[0]}`);
  const fits: i32 = websocketWriteFrame(out, at, true, WS_OP_TEXT, payload, off, 1, null);
  console.log(`framing byte 1: ends at ${fits}, opcode byte ${out[0]}`);
  return 0;
};
