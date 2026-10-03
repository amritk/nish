// `http1Chunk` with a window outside its buffer panics (exit 1,
// "http1Chunk: the window is outside the buffer" on stderr) rather than
// writing a chunk whose size line promises bytes it does not hold. Stdout
// stops at the line before the call.
import { http1Chunk } from "nish/net/http1";

export const main = (): i32 => {
  const data: u8[] = [104, 105];
  const off: i32 = -1;
  const len: i32 = 2;
  console.log("a chunk from offset -1");
  const out: u8[] = http1Chunk(data, off, len);
  console.log(`unreachable: ${toI32(out.length)} bytes written`);
  return 0;
};
