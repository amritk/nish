declare function abs(n: i32): i32;

const pureDouble = (n: i32): i32 => n * 2;

export const main = (): i32 => abs(-7) + pureDouble(3);
