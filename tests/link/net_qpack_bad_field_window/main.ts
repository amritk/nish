// A field's name and value are windows the program chose, so a window that
// does not lie inside its buffer panics in the encoder rather than reading
// past it.
//
// It panics, on stderr, with
//
//     QpackEncoder.encodeField: the window [1, 1 + 5) is outside a buffer of 5 bytes
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QpackEncoder } from "nish/net/qpack";

export const main = (): i32 => {
  const enc = new QpackEncoder();
  const out: u8[] = [];
  const name: u8[] = [58, 112, 97, 116, 104];
  const value: u8[] = [47];
  const zero: i32 = 0;
  const one: i32 = 1;
  const five: i32 = 5;
  enc.encodeField(out, name, zero, five, value, zero, one, false, false);
  console.log(`a field inside its windows: ${out.length} byte`);
  enc.encodeField(out, name, one, five, value, zero, one, false, false);
  console.log(`unreachable: ${out.length} bytes`);
  return 0;
};
