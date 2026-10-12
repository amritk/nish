// `String.fromBytes` copies bytes, so its first argument is a `u8[]`, readonly
// or not, and nothing else: not a wider element (`u16[]`, `i32[]`) read
// only or not, not a nullable array (narrow it first), and not a string.
const halves = (xs: u16[]): string => String.fromBytes(xs, 0, 1);

const numbers = (xs: number[]): string => String.fromBytes(xs, 0, 1);

const frozen = (xs: readonly i32[]): string => String.fromBytes(xs, 0, 1);

const maybe = (xs: u8[] | null): string => String.fromBytes(xs, 0, 1);

const text = (s: string): string => String.fromBytes(s, 0, 1);
