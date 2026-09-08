// `process.platform` and `process.arch` (WP14 §7a): what machine the compiled
// *program* runs on, which is the only question `--target host` is asking.
//
// A golden that printed the two strings would be a golden on one machine and a
// failure on the next, so what is pinned here is what does not vary: both are
// non-empty, both answer the same string every time they are read, and the
// pair maps to a triple this compiler supports — `hostTriple` below is the
// mapping `src/codegen/target.ts` and `self/target.ts` both make, spelled once
// more so the case proves the strings are the ones that mapping expects.
function hostTriple(platform: string, arch: string): string {
  let cpu = "";
  if (arch === "x64") {
    cpu = "x86_64";
  } else if (arch === "arm64") {
    cpu = "aarch64";
  }
  if (cpu.length === 0) {
    return "";
  }
  if (platform === "linux") {
    return `${cpu}-unknown-linux-gnu`;
  }
  if (platform === "darwin") {
    return `${cpu}-apple-darwin`;
  }
  return "";
}

export function main(): number {
  const platform = process.platform;
  const arch = process.arch;
  console.log(`platform: ${platform.length > 0 && platform === process.platform}`);
  console.log(`arch: ${arch.length > 0 && arch === process.arch}`);
  console.log(`triple: ${hostTriple(platform, arch).length > 0}`);
  return 0;
}
