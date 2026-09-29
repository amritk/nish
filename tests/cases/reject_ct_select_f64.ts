// WP34 N6: in f64 mode a `number` is a double, which has no bit pattern the
// builtins could mask (NL2399).
export const pick = (mask: number, a: number, b: number): number => ctSelect(mask, a, b);
