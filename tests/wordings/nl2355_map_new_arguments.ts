// NL2355: `new Map(...)` with arguments; a map starts empty in this version.
export const main = (): i32 => {
  new Map<string, i32>(4);
  return 0;
};
