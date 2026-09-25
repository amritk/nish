// WP29: an arrow takes exactly the parameters its function type does.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

export const main = (): i32 => apply((a, b) => a + b, 2);
