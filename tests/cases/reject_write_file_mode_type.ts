// The mode is an `i32`; a string spelling of it is not converted.
export const main = (): number => {
  return writeFileSyncMode("build/test/a", "x", "600");
};
