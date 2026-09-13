// NL2180: A property assignment on a value that is not a struct names the type it was.
export const main = (): i32 => {
  const s: string = "a";
  s.size = 1;
  return 0;
};
