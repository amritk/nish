// A table's maximum size is the program's choice, so a negative one panics
// rather than answering a table no entry fits.
//
// It panics, on stderr, with
//
//     HpackTable: a maximum size of -1
//
// and exits 1; stdout stops at the line printed for the smallest accepted
// size. The link harness compares stdout and the exit code only, so the
// message is named here rather than pinned.
import { HpackEncoder } from "nish/net/hpack";

export const main = (): i32 => {
  const zero = new HpackEncoder(0);
  console.log(`a table of ${zero.table.maxSize} bytes: ${zero.table.count()} entries`);
  const refused = new HpackEncoder(-1);
  console.log(`unreachable: a table of ${refused.table.maxSize} bytes`);
  return 0;
};
