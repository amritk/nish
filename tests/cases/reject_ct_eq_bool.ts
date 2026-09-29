// WP34 N6: two booleans compare with `===`, which is exactly the compare the
// constant-time builtins exist to keep out of reach (NL2399).
export const same = (a: boolean, b: boolean): boolean => ctEq(a, b);
