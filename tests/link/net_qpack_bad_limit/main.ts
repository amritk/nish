// A field-section limit is the program's own number, so a negative one panics
// in the constructor rather than refusing every section.
//
// It panics, on stderr, with
//
//     QpackDecoder: a field-section limit of -1
//
// and exits 1. The link harness compares stdout and the exit code only, so
// the message is named here rather than pinned.
import { QpackDecoder } from "nish/net/qpack";

export const main = (): i32 => {
  const zero: i32 = 0;
  const empty = new QpackDecoder(zero);
  console.log(`a limit of ${empty.maxFieldSectionSize} bytes`);
  const negative: i32 = -1;
  const bad = new QpackDecoder(negative);
  console.log(`unreachable: a limit of ${bad.maxFieldSectionSize} bytes`);
  return 0;
};
