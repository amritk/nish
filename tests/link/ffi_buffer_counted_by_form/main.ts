// `CountedBy` takes the buffer and the count's name as a string literal; a
// missing name, a name that is not a string, an empty name, the name `"?"`
// and a buffer that is not a `u8[]` are each refused where they are written.
declare function no_name(dst: CountedBy<u8[]>, n: u32): i32
declare function bare_name(dst: CountedBy<u8[], u32>, n: u32): i32
declare function empty_name(dst: CountedBy<u8[], "">, n: u32): i32
declare function query_name(dst: CountedBy<u8[], "?">, n: u32): i32
declare function not_bytes(dst: CountedBy<i32, "n">, n: u32): i32

export const main = (): i32 => 0
