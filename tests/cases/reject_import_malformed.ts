// An `import` that opens neither an import nor `import(...)` is the syntax
// error it always was, the `{` the one import form wants, and costs the
// diagnostics it always did.
import;

export const main = (): i32 => 0;
