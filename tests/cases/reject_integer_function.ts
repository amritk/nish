// `integer` is reserved for ranged integers (WP31). A function shares the one
// declaration namespace with every type, so it may not take the name either.
const integer = (x: i32): i32 => x;

export const test = (): number => integer(0);
