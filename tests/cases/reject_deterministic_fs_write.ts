// --deterministic refuses `fs.write` (NL3052), even though writing is an effect:
// whether it succeeds is the file system's answer.
export const main = (): number => {
  writeFileSync("out.txt", "x");
  return 0;
};
