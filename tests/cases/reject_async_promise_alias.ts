// A type alias naming `Promise<T>` would let a promise be spelled anywhere
// the alias is, so the alias itself is refused (NL2636).
type Later = Promise<i32>

export const main = (): i32 => 0
