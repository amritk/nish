// One name, and no default: `getenv` answers null and the caller decides.
export function main(): number {
  const v = getenv("PATH", "fallback");
  return v === null ? 1 : 0;
}
