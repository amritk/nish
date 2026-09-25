// NL2342: an unannotated arrow parameter whose type is a type parameter that
// only the arrow itself could bind.
const count = <T>(pred: (x: T) => boolean): i32 => 0;

export const main = (): i32 => count((x) => true);
