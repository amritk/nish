// WP34 N6: with only literals there is no operand to take a width from, and a
// bare literal is a `number`, which is an i32 (NL2399).
export const same = (): u32 => ctEq(1, 2);
