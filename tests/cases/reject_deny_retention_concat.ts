// --deny-retention: NL9002, a string rebuilt from itself in a loop, is an error.
export const main = (): void => {
  let out = "";
  for (let i = 0; i < 100; i++) {
    out = out + "ab";
  }
  console.log(out);
};
