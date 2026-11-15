// NL2378: `integer<Lo, Hi>` written with other than two bounds.
const widen = (x: integer<i32>): i32 => x

export const main = (): i32 => widen(0)
