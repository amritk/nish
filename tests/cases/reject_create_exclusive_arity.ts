// `createFileExclusiveSync` takes a path, the data and a mode: three arguments.
export function main(): number {
  return createFileExclusiveSync("build/test/a.lock", "x", 0o600, 0);
}
