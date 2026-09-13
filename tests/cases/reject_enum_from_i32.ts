// The other direction: an integer is not a member of the enum just because it
// happens to be one of its numbers.
enum Kind {
  If = 1,
  While = 2,
}

export const test = (): i32 => {
  const k: Kind = 1;
  return 0;
};
