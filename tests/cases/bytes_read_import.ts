// WP34 N2: `readFileBytesSync` is exported by `nish:fs` beside the other file
// reads, and the import renames the builtin rather than adding one.
import { readFileBytesSync as bytesOf } from "nish:fs";

export const test = (): number => {
  const bytes = bytesOf("tests/cases/bytes_read.bin");
  if (bytes === null) {
    return -1;
  }
  return toI32(bytes[3]) + toI32(bytes[4]);
};
