export function main(): number {
  const cc = getenv("CC");
  console.log(`cc: ${cc === null ? "clang" : cc}`);
  return 0;
}
