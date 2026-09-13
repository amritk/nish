// `join` takes the separator and nothing else.
export const run = (): string => {
  const parts: string[] = ["a", "b"];
  return parts.join(",", "!");
};
