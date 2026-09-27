// `integer` in a type position is a ranged integer (WP31), and without its two
// bounds it names no range; it is refused by that rule rather than as an
// unknown type.
const clamp = (x: integer): i32 => x;

export const test = (): number => clamp(0);
