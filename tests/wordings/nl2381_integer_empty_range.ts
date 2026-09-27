// NL2381: `integer<Lo, Hi>` with Lo above Hi.
const f = (x: integer<1, -1>): i32 => x

export const main = (): i32 => f(0)
