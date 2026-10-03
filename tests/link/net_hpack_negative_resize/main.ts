// `HpackEncoder.setMaxTableSize` with a negative size panics in the table's
// resize, as the constructor does for a negative first size.
//
// It panics, on stderr, with
//
//     HpackTable.resize: a maximum size of -1
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { HpackEncoder } from "nish/net/hpack";

export const main = (): i32 => {
  const enc = new HpackEncoder(4096);
  enc.setMaxTableSize(0);
  console.log(`resized to ${enc.table.maxSize} bytes`);
  enc.setMaxTableSize(-1);
  console.log(`unreachable: resized to ${enc.table.maxSize} bytes`);
  return 0;
};
