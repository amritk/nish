// A `CPtr` stays opaque: it is never indexed, so no read or write through
// a pointer C gave out reaches memory the compiler knows nothing about.
// `readCString` in `nish:unsafe` is the one read, and it copies.
declare function malloc(n: u64): CPtr;

export const main = (): i32 => {
  const p = malloc(8);
  const b = p[0];
  return 0;
};
