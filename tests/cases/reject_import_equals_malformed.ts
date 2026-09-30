// A malformed `import x = ...` is one syntax error, and the rest of its
// statement is passed over rather than read into a cascade.
import x = 5;

export const main = (): i32 => 0;
