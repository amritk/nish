// WP27 S5: `cErrno()` answers the errno the most recent `declare function`
// call left. Naming it makes every foreign call in the program store 0 into
// errno just before the call and copy errno into the runtime's slot just after,
// before the result is marshalled. Before any call it is 0; `open` on a missing
// path leaves ENOENT; `quiet` (in ffi_errno.c) answers a `string` and touches
// no errno, so it reads 0 right after that ENOENT; `strtol` reports
// ERANGE only out of range, which is what the zeroing is for; and `errno_says`
// (in ffi_errno.c) sets errno and answers a `string`, whose copy into the arena
// comes after the save.
import { cErrno } from "nish:unsafe";

declare function open(path: string, flags: i32): i32;
declare function strtol(s: string, end: CPtr | null, base: i32): i64;
declare function errno_says(e: i32): string;
declare function quiet(): string;

/** Reads the slot and nothing else. */
function lastErrno(): i32 {
  return cErrno();
}

export function run(): i32 {
  console.log(`before any call: ${lastErrno()}`);
  const fd = open("/nonexistent/nish-errno", 0);
  console.log(`open: ${fd} errno ${lastErrno()}`);
  const q = quiet();
  console.log(`quiet: ${q} errno ${cErrno()}`);
  const big = strtol("99999999999999999999999", null, 10);
  console.log(`strtol out of range: ${big > 4000000000000000} errno ${cErrno()}`);
  const small = strtol("42", null, 10);
  console.log(`strtol in range: ${small} errno ${cErrno()}`);
  const said = errno_says(5);
  console.log(`errno_says: ${said} errno ${cErrno()}`);
  return cErrno();
}
