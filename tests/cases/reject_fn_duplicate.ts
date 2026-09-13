// One name, one function: there is no overloading.
const twice = (n: i32): i32 => n * 2;

export const thrice = (n: i32): i32 => n * 3;

const twice = (n: i32): i32 => n + n;
