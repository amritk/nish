// Spread would need a runtime copy of an unknown length at a literal's site.
export const xs = (): number => {
  const a: number[] = [1, 2];
  const b: number[] = [...a, 3];
  return b.length;
};
