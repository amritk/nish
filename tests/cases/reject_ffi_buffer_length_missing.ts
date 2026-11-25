// A run of buffers is closed by one `u64`, the count of elements C may
// touch in every buffer of the run (WP53 B1.1, WP89 S2). `SHA256(d, n,
// md)` writes 32 bytes into `md` and takes no count for it, so the
// trailing buffer has nothing to hold the call to and the declaration is
// refused.
declare function SHA256(d: readonly u8[], n: u64, md: u8[]): CPtr;

export const main = (): i32 => 0;
