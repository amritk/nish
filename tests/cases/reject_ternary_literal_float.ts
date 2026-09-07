// A ternary arm inherits its *context*, and an unannotated `const` supplies
// none: without one, `1.5` is an i32 literal in i32 mode, exactly as it would
// be outside a ternary.
export function test(): number {
  const scale = true ? 1.5 : 2.5;
  return scale > 1.0 ? 1 : 0;
}
