// The mode is an `i32`; a string spelling of it is not converted.
export const main = (): number => {
  return createFileExclusiveSync("build/test/a.lock", "x", "600");
};
