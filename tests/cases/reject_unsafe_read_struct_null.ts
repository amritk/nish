// WP27 S4.2: `readStruct` takes one `CPtr`, which is never null, so a C `NULL`
// cannot reach the copy: a `CPtr | null` is narrowed with `!== null` first, as
// for `readCString`.
import { readStruct } from "nish:unsafe";

declare class Passwd {
  name: CPtr
}

declare function getpwnam(name: string): CPtr | null;

export function main(): i32 {
  const p = getpwnam("root");
  const unnarrowed: Passwd = readStruct(p);
  const none: Passwd = readStruct();
  return unnarrowed.name === none.name ? 0 : 1;
}
