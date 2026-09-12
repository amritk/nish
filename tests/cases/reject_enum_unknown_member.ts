// The members are the whole of an enum's value space: there is no cast that
// invents one.
enum Kind {
  If = 1,
}

export const test = (): i32 => {
  const k: Kind = Kind.Nope;
  return 0;
};
