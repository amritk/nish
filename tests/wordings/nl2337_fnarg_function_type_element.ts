// NL2337: a function type anywhere a value would have it, here the element
// type of an array parameter: an array of functions is an array of values.
const run = (fs: ((x: i32) => i32)[]): i32 => fs.length;

export const main = (): i32 => 0;
