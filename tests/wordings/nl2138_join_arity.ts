// NL2138: `join` takes at most a separator; the message names how many arguments arrived.
export const main = (): i32 => {
  const xs: string[] = ["a"];
  const s: string = xs.join(",", ";");
  return 0;
};
