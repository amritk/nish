// The point of the nullable: the value cannot be read before the null is
// ruled out, exactly as `readFileSyncOrNull`'s cannot.
export function main(): number {
  const home = getenv("HOME");
  return home.length;
}
