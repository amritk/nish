// `integer` in a type position is reserved for ranged integers (WP31), which
// are not built yet; it is refused by name rather than as an unknown type.
const clamp = (x: integer): i32 => x;

export const test = (): number => clamp(0);
