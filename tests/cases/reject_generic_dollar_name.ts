// `$` separates a generic's name from its type arguments in every symbol the
// compiler emits, so a declared name may not contain one. WP18 §3c.
const identity$i32 = (x: i32): i32 => x;

export const test = (): number => identity$i32(1);
