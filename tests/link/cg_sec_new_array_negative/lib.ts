// The allocation under test, in a module of its own so the length crosses a call.
export const bytes = (n: i32): u8[] => new Array<u8>(n);
