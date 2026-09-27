// A ranged type's bound is a numeric literal, so a misplaced separator in it
// is refused by the lexer before the bound is read (issue #263): without the
// refusal `integer<0, 0x_FF>` would be `integer<0, 255>`.
const low = (x: integer<0, 0x_FF>): i32 => x;
export const main = (): i32 => low(1);
