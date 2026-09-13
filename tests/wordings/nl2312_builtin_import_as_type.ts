// NL2312: a `nish:` import binds a builtin, which is a function or a value and
// never a type, so naming it in a type position is refused against the import
// that bound it — the declaration to fix — the way NL2073 refuses an imported
// function used the same way.
import { write } from "nish:io";

const use = (x: write): i32 => 1;

export const main = (): i32 => 0;
