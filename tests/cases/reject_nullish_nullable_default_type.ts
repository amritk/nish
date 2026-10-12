// The default of `??` on a `T | null` stands in for the value, so it is a `T`
// (or a `T | null`), never another type.
export const main = (): i32 => {
  const name: string | null = null;
  return name ?? 0;
};
