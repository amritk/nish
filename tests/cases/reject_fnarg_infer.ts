// WP29: an unannotated arrow parameter takes its type from the function type,
// which here mentions a `T` that no other argument binds.
const run = <T>(f: (x: T) => i32): i32 => 0;

export const main = (): i32 => run((x) => 1);
