export const counted = (): i32 => {
  const m = new Map<string, i32>();
  m.set("a", 1);
  return m.size;
};
