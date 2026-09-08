// The argument vector is handed to the C `execvp` as it stands, so the element
// type is checked too: an `i32[]` is an array but not a command line.
export function main(): number {
  const argv: number[] = [1, 2];
  return spawnSync(argv);
}
