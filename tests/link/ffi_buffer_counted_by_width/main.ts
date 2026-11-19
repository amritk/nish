// A count is unsigned: a `u8`, `u16`, `u32` or `u64`, or an out class whose one
// field is one (zlib's `uLongf *destLen`). A signed count, an out class with a
// signed or a second field, and a nullable count are refused.
declare class SignedLen {
  value: i64
}

declare class TwoFields {
  value: u64
  spare: u64
}

declare function signed_count(dst: CountedBy<u8[], "n">, n: i64): i32
declare function signed_field(dst: CountedBy<u8[], "n">, n: SignedLen): i32
declare function two_fields(dst: CountedBy<u8[], "n">, n: TwoFields): i32
declare function maybe_count(dst: CountedBy<u8[], "n">, n: SignedLen | null): i32

export const main = (): i32 => 0
