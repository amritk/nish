// WP34 N6: a secret select and a secret compare. The mask goes through an empty
// `asm` that LLVM cannot see into, so no pass can rebuild a `select` from it.
export const pick = (mask: u32, a: u32, b: u32): u32 => ctSelect(mask, a, b)

export const same = (a: u64, b: u64): u64 => ctEq(a, b)
