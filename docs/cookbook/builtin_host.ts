export function main(): number {
  const out = "build/out";
  if (!isDirectorySync(out) && !mkdirSync(out)) {
    panic(`cannot create ${out}`);
  }
  console.log(`${process.platform} ${process.arch}`);
  return 0;
}
