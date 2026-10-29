// `writeFileSyncMode` takes the mode with the path and the data: three arguments.
export function main(): number {
  return writeFileSyncMode("build/test/a", "x");
}
