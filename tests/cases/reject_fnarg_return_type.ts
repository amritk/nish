// WP51: a function may return a function reference, and what it returns is
// checked against that type: `0` is not a function.
const make = (): (x: i32) => i32 => 0;

export const main = (): i32 => 0;
