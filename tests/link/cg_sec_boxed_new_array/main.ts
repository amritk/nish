// CG-1/CG-2 through a boxed field: `new Array<T>(n)` assigned to a field the
// compiler boxes (`{ i64, i8* }` in the object) is lowered by
// `emitBoxedArrayAssignment`, not `emitNewArray`, and must refuse a negative
// length parsed from input with `array length out of range` (exit 1) before
// anything is allocated, as `cg_sec_new_array_negative` pins for the header
// path. A length that fits is still taken as it stands.
// docs/security/codegen.md, CG-1 and CG-2.
import { Buf } from "./lib";

export const main = (): number => {
  const fits = new Buf(toI32(parseInt("5")));
  console.log(`fits ${fits.bytes.length}`);
  const bad = new Buf(toI32(parseInt("-1")));
  console.log(`after ${bad.bytes.length}`);
  return 0;
};
