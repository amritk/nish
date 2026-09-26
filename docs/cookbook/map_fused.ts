export const count = (counts: Map<string, i32>, w: string): void => {
  counts.set(w, (counts.get(w) ?? 0) + 1);
};

export const firstTime = (seen: Set<string>, w: string): boolean => {
  if (!seen.has(w)) {
    seen.add(w);
    return true;
  }
  return false;
};
