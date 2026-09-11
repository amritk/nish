export const main = (): number => {
  const cc = getenv("CC");
  const compiler = cc === null ? "clang" : cc;
  console.log(`building with ${compiler}`);
  return 0;
};
