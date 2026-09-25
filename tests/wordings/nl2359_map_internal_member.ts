// NL2359: a member of the table itself, which a program cannot see.
export const main = (): i32 => {
  const s = new Set<i32>();
  return s.live;
};
