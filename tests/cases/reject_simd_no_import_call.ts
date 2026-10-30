// A function whose signature names no vector still calls `nish:simd`'s names
// only through the import: the call itself is refused, naming the first one.
export const h = (xs: i32[]): i32 => extract(loadI32x4(xs, 0), 0);
