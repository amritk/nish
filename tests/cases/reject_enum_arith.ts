// An enum is not numeric, so it does not add. Its members are names for
// distinct cases, and arithmetic on them asks a question about the numbering.
enum Kind {
  If = 1,
  While = 2,
}

export const test = (): Kind => {
  const k: Kind = Kind.If;
  return k + Kind.While;
};
