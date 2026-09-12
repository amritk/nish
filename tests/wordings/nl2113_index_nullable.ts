// NL2113: Indexing a nullable array needs the null check first, and the message writes it out.
export const main = (): i32 => {
  const xs: i32[] | null = null;
  return xs[0];
};
