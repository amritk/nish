// A variadic C function is not declared variadically: the C variadic ABI
// differs from a fixed one, and the IR `declare` has no spelling for it. A
// rest parameter is refused by its form before its type is read, so a
// `...bytes: u8[]` gets this message and never a buffer's.
declare function printf(fmt: string, ...args: i32[]): i32;
declare function emit(...bytes: u8[]): i32;

export const main = (): i32 => 0;
