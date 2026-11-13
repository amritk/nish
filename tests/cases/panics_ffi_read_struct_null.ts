// WP27 S4.2: `readStruct(p)` tests `p` for `NULL` before it copies, so a C
// function that answers `NULL` where a struct was promised stops the program
// with an `ffi-null` panic, exit 1, rather than a read of address 0 (which
// wasm32 would allow). `present` reads a real struct through the same check.
import { readStruct } from "nish:unsafe";

declare class Pair {
  first: i32
  second: i32
}

declare function pairPtr(): CPtr
declare function nullPtr(): CPtr

export function present(): i32 {
  const p: Pair = readStruct(pairPtr());
  return p.first + p.second;
}

export function absent(): i32 {
  const p: Pair = readStruct(nullPtr());
  return p.first;
}
