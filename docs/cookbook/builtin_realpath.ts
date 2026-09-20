export const main = (): number => {
  const here = realpathSync(".");
  const root = here === null ? "." : here;
  console.log(`resolved to ${root}`);
  return 0;
};
