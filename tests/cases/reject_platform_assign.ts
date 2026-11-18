// What machine this is, is not the program's to decide.
export const main = (): number => {
  process.platform = "win32";
  return 0;
};
