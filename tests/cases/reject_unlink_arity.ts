// `unlinkSync` removes one name: exactly one path.
export function main(): number {
  return unlinkSync("build/test/a", "build/test/b");
}
