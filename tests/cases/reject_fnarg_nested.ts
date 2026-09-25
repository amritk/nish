// WP29: a callee that itself takes a function would need its own function
// argument at the same call, which is a function value by another name.
const outer = (f: (g: (x: i32) => i32) => i32): i32 => 0;

export const main = (): i32 => 0;
