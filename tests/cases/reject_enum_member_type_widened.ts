// Nothing converts from an enum to one of its member types: a `Kind` value
// that is not a member's constant could be any member, so it is refused even
// where it happens to hold the right one.
enum Kind {
  Scalar,
  Array,
}

const tag = (k: Kind): Kind.Array => k;

export const test = (): number => (tag(Kind.Array) === Kind.Array ? 1 : 0);
