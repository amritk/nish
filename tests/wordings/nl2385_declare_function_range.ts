// NL2385: a ranged integer in a `declare function` signature.
declare function putchar(c: integer<0, 255>): i32

export const main = (): i32 => putchar(65)
