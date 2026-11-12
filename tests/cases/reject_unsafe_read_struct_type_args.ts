// WP27 S4.2: a type argument is not written at a call site (WP18 §2a), so
// `readStruct<Lconv>(p)` is refused with the annotated spelling in the message.
import { readStruct } from "nish:unsafe";

declare class Lconv {
  decimalPoint: CPtr
}

declare function localeconv(): CPtr;

export function main(): i32 {
  const lc = readStruct<Lconv>(localeconv());
  return 0;
}
