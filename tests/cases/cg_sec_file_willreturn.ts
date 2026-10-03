// `nish_read_file`, `nish_write_file` and `nish_append_file` were declared
// `willreturn`, but they `_exit(1)` on a path they cannot read or write, and
// an `open` of a FIFO with no writer waits for ever; every caller inherited the
// claim. The file calls are `nounwind` alone now, and so are their callers
// (docs/security/codegen.md, CG-8). `bump` beside them keeps `willreturn`.

export const save = (path: string, text: string): void => {
  writeFileSync(path, text);
  appendFileSync(path, "!");
};

export const load = (path: string): i32 => readFileSync(path).length;

export const bump = (x: i32): i32 => x + 1;
