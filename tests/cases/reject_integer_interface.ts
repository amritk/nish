// `integer` is reserved for ranged integers (WP31): an interface of that name
// would make `integer<0, 255>` mean two things in this module.
interface integer {
  value: i32;
}

export const test = (): number => 0;
