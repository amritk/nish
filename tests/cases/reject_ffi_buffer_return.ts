// A buffer never comes back from C: the pointer it would return has no
// length the compiler knows, so a `u8[]` result is refused like any other
// type that is not a scalar, a `CPtr` or a copied `string`.
declare function getbuf(n: u64): u8[];

export const main = (): i32 => 0;
