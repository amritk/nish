export const bump = (m: Map<string, i32>, w: string): void => {
  m.set(w, (m.get(w) ?? 0) + 1);
};

export const known = (m: Map<string, i32>, w: string): i32 => {
  const n = m.get(w);
  if (n === undefined) {
    return -1;
  }
  return n;
};
