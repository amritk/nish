// `integer` is reserved for ranged integers (`integer<Lo, Hi>`, WP31), so an
// enum may not take it, for the reason an alias may not.
enum integer {
  A = 1,
}

export const test = (): number => 0;
