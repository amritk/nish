// A run of `u8[]` parameters is closed by one `u64`, the byte count C may
// touch in every buffer of the run (WP40 B1.1). `SHA256(d, n, md)` writes 32
// bytes into `md` and takes no count for it, so the trailing buffer has
// nothing to hold the call to and the declaration is refused.
declare function SHA256(d: readonly u8[], n: u64, md: u8[]): CPtr;

export const main = (): i32 => 0;
