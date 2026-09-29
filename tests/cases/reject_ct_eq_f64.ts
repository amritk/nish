// WP34 N6: in f64 mode a `number` is a double, and ctEq compares bit
// patterns of the unsigned words only (NL2399).
export const same = (a: number, b: number): number => ctEq(a, b);
