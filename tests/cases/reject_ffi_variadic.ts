// A variadic C function is not declared variadically: the C variadic ABI
// differs from a fixed one, and the IR `declare` has no spelling for it. A
// rest `u8[]` is pinned on its own by `reject_ffi_buffer_rest`.
declare function printf(fmt: string, ...args: i32[]): i32;

export const main = (): i32 => 0;
