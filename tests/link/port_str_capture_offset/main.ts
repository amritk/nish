// WP33 NL8001 through a capture (WP29): `at` holds a UTF-8 byte offset, and
// the arrow `parallelFrom` runs compares it with a count written into the
// program, as the direct comparison does (tests/cases/port_str_length_printed
// is the row); the warning is at the captured read. Native prints `0`, where
// `l` is byte 3; TypeScript `1`, where it is unit 2.
import { parallelFrom } from "nish/threads";

export const main = (): i32 => {
  const word = "héllo";
  const at = word.indexOf("l");
  const ys = parallelFrom(1, (k) => (at === 2 ? 1 : 0) + k);
  console.log(`${ys[0]}`);
  return 0;
};
