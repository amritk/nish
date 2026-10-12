// NL2489: `??` defaulting an element read, where Node and native disagree past the end.
export const main = (): i32 => {
  const names = new Array<string | null>(1);
  return (names[3] ?? "none").length;
};
