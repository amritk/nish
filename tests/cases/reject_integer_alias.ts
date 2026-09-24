// `integer` is reserved for ranged integers (`integer<Lo, Hi>`, WP31), so an
// alias may not take it: the day it becomes a type, the alias would silently
// stop being looked at.
type integer = i32;

export const test = (): number => 0;
