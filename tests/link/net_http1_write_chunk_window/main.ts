// `http1WriteChunk` with a window outside its source panics (exit 1,
// "http1WriteChunk: the window is outside the buffer" on stderr) rather than
// framing bytes it was not given. Stdout stops at the line before the call.
import { http1WriteChunk } from "nish/net/http1";

export const main = (): i32 => {
  const out: u8[] = new Array<u8>(64);
  const data: u8[] = [97, 98, 99];
  const at: i32 = 0;
  const off: i32 = 2;
  const len: i32 = 4;
  console.log("chunking bytes 2 to 6 of a 3-byte array");
  http1WriteChunk(out, at, data, off, len);
  console.log("unreachable: the window was accepted");
  return 0;
};
