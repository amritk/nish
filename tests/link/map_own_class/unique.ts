export const distinct = (): i32 => {
  const s = new Set<i32>();
  s.add(1).add(2).add(1);
  return s.size;
};
