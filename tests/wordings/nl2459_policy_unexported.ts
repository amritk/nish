// Under `--no-strict-exports` every function has external linkage, so in an
// open build a host can call one nobody exported: the private `load` reaches
// `fs.read`, which `--deny fs.read` refuses (NL2459).
const load = (path: string): string => readFileSync(path);

export const size = (): i32 => 3;
