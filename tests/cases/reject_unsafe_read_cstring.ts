// WP27 S3.3: `readCString` takes one `CPtr`, which is never null, so a C
// `NULL` cannot reach the read: a `CPtr | null` is narrowed with `!== null`
// first, and a string or a number is not a pointer at all.
import { readCString } from "nish:unsafe";

declare function getcwd(buf: CPtr | null, size: u64): CPtr | null;

export function main(): i32 {
  const p = getcwd(null, 0);
  const unnarrowed = readCString(p);
  const text = readCString("x");
  const none = readCString();
  return unnarrowed.length + text.length + none.length;
}
