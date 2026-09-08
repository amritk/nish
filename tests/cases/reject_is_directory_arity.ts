// One path, and no options: `isDirectorySync` asks one question.
export function main(): number {
  return isDirectorySync(".", "recursive") ? 0 : 1;
}
