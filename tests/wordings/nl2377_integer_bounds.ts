// NL2377: `integer<Lo, Hi>` written with other than two bounds (WP31).
const widen = (x: integer<i32>): i32 => x

export const main = (): i32 => widen(0)
