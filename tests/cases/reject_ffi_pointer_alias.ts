// `CPtr` is answered before any declared name is consulted (WP27 S2), so an
// alias under that name would never be looked at. Silently, which is the part
// worth refusing — and the two compilers have to refuse it in the same words,
// which is what this case is for.
type CPtr = i32;

export const main = (): i32 => 0;
