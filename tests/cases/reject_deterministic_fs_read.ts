// --deterministic refuses `fs.read` (NL3052): a file differs from host to host.
export const main = (): number => {
  console.log(readFileSync("input.txt").length);
  return 0;
};
