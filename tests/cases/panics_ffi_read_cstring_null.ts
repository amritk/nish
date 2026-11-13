// `readCString(p)` tests `p` for `NULL` before it copies, as `readStruct`
// does, so a C function declared to answer a plain `CPtr` that answers `NULL`
// stops the program with an `ffi-null` panic, exit 1, rather than a read of
// address 0 (a fault natively, garbage on wasm32). `present` reads a real C
// string through the same check.
import { readCString } from "nish:unsafe";

declare function textPtr(): CPtr
declare function nullPtr(): CPtr

export function present(): i32 {
  const s: string = readCString(textPtr());
  return s.length;
}

export function absent(): i32 {
  const s: string = readCString(nullPtr());
  return s.length;
}
