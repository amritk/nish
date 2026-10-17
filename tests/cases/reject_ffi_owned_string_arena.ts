// WP27 S3.3: a `readCString` copy made inside a `using a = arena()` block is
// the block's allocation, as a `declare function`'s `string` result is
// (`reject_ffi_string_arena`), so a local declared outside the block cannot
// keep it. Refused in a loop and outside one.
import { readCString } from "nish:unsafe";

declare function strdup(s: string): CPtr | null;
declare function free(p: CPtr): void;

function looped(n: i32): string {
  const p = strdup("owned by C");
  if (p === null) {
    return "";
  }
  let s = "";
  {
    using a = arena();
    for (let i = 0; i < n; i++) {
      s = readCString(p);
    }
  }
  free(p);
  return s;
}

function direct(): string {
  const q = strdup("owned by C");
  if (q === null) {
    return "";
  }
  let s = "";
  {
    using a = arena();
    s = readCString(q);
  }
  free(q);
  return s;
}

export function main(): i32 {
  console.log(looped(4));
  console.log(direct());
  return 0;
}
