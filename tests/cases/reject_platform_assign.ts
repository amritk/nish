// What machine this is, is not the program's to decide.
export function main(): number {
  process.platform = "win32";
  return 0;
}
