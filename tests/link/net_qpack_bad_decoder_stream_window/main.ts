// The decoder stream's bytes are a window the program chose, so a window that
// does not lie inside its buffer panics in the encoder rather than reading
// past it.
//
// It panics, on stderr, with
//
//     QpackEncoder.receiveDecoderStream: the window [-1, -1 + 1) is outside a buffer of 1 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QpackEncoder } from "nish/net/qpack";

export const main = (): i32 => {
  const enc = new QpackEncoder();
  const stream: u8[] = [72];
  const zero: i32 = 0;
  const one: i32 = 1;
  const before: i32 = -1;
  console.log(`a Stream Cancellation, inside the window: ${enc.receiveDecoderStream(stream, zero, one)}`);
  console.log(`unreachable: ${enc.receiveDecoderStream(stream, before, one)}`);
  return 0;
};
