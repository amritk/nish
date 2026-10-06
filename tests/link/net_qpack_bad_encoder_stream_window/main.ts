// The encoder stream's bytes are a window the program chose, so a window that
// does not lie inside its buffer panics in the decoder rather than reading
// past it.
//
// It panics, on stderr, with
//
//     QpackDecoder.receiveEncoderStream: the window [1, 1 + 2) is outside a buffer of 2 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QpackDecoder } from "nish/net/qpack";

export const main = (): i32 => {
  const limit: i32 = 4096;
  const dec = new QpackDecoder(limit);
  const stream: u8[] = [32, 32];
  const one: i32 = 1;
  const two: i32 = 2;
  console.log(`Set Dynamic Table Capacity 0, inside the window: ${dec.receiveEncoderStream(stream, one, one)}`);
  console.log(`unreachable: ${dec.receiveEncoderStream(stream, one, two)}`);
  return 0;
};
