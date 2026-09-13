// An enum is a distinct type, not a spelling of `i32`: the whole point of
// WP23 §3 is that a discriminant cannot be handed to something expecting a
// plain integer, in either direction.
enum Kind {
  If = 1,
  While = 2,
}

export const test = (): i32 => {
  const k: Kind = Kind.If;
  const n: i32 = k;
  return n;
};
