// The runtime calls that can `_exit(1)` are not declared `willreturn`, and a
// caller of one is not inferred `willreturn` either: `readFileSync` exits on a
// missing file, `writeFileSync` and `appendFileSync` on an unwritable one (and
// `open()` can block on a FIFO with no writer), and a concatenation exits when
// its result would pass 2^31 - 1 bytes (RT-2). docs/security/codegen.md, CG-8.
const load = (path: string): string => readFileSync(path);

const save = (path: string, text: string): void => {
  writeFileSync(path, text);
};

const extend = (path: string, text: string): void => {
  appendFileSync(path, text);
};

const glue = (a: string, b: string): string => a + b;

export const test = (): number => {
  const path = "build/test/cg_sec_exiting_runtime.txt";
  save(path, glue("hello", "\n"));
  extend(path, "world\n");
  const text = load(path);
  console.log(text);
  return text.length;
};
