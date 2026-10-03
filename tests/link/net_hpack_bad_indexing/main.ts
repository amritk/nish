// `HpackEncoder.encodeField` takes one of the three `HPACK_INDEX_*` modes, and
// anything else panics: the mode is the program's choice.
//
// It panics, on stderr, with
//
//     HpackEncoder.encodeField: an indexing mode of 3
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { HPACK_INDEX_NEVER, HpackEncoder } from "nish/net/hpack";

export const main = (): i32 => {
  const enc = new HpackEncoder(4096);
  const name: u8[] = [97];
  const value: u8[] = [];
  const out: u8[] = [];
  enc.encodeField(out, name, value, HPACK_INDEX_NEVER, false);
  console.log(`never indexed: ${toI32(out.length)} bytes`);
  enc.encodeField(out, name, value, 3, false);
  console.log(`unreachable: ${toI32(out.length)} bytes`);
  return 0;
};
