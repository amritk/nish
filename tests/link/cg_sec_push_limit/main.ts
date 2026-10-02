// A push never takes an array past 2^31 - 1 elements. Under the default
// `--number-mode i32` `length` is an `i32`, and the element after that read
// back as -2147483648: every std function then saw a short or negative array,
// so a hash or a tag compare of 4 GiB answered for its first few bytes.
// docs/security/codegen.md, finding K1-6.
import { pushOne } from "./lib";

export const main = (): number => {
  const a: u8[] = new Array<u8>(2147483647);
  console.log(`full ${a.length}`);
  pushOne(a);
  console.log(`after ${a.length}`);
  return 0;
};
