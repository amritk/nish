// `writeFileSyncMode` takes the mode with the path and the data: three arguments.
export const main = (): number => {
  return writeFileSyncMode("build/test/a", "x");
};
