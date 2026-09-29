// NL8001: a UTF-8 byte count returned as `main`'s exit code, which TypeScript
// counts in UTF-16 units.
export const main = (): number => {
  const name = "héllo";
  return name.length;
};
