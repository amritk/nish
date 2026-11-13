// WP27 S4.2: `readStruct` takes its layout from the type its result goes to,
// as `Ok(v)` does, so a call with no annotation, parameter or return type to
// name one is refused, and so is a context that is not a `declare class`: a
// Nish class has no C layout to copy into.
import { readStruct } from "nish:unsafe";

declare class Lconv {
  decimalPoint: CPtr
}

class Plain {
  x: i32 = 0
}

declare function localeconv(): CPtr;

export function main(): i32 {
  const bare = readStruct(localeconv());
  const plain: Plain = readStruct(localeconv());
  const scalar: i32 = readStruct(localeconv());
  const ok: Lconv = readStruct(localeconv());
  return plain.x + scalar + (ok.decimalPoint === ok.decimalPoint ? 0 : 1);
}
