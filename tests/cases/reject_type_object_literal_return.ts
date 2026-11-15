// A return type is a declared name, even where the body is an object literal
// that would fit it.
export const origin = (): { x: i32 } => ({ x: 0 });
