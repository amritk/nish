const divide = (a: u32, b: u32): u32 => a / b;

const below = (a: u32, b: u32): boolean => a < b;

const halve = (a: u32): u32 => a >> 1;

const widen = (a: u32): u64 => toU64(a);

const reinterpret = (a: i32): u32 => toU32(a);
