// An object literal's property value is checked with no contextual *numeric*
// type: `docs/LANGUAGE.md`'s table grants a class field's initializer and a
// field assignment target their field's type, but not this position, so in f64
// mode the bare `2` is an `f64` where the field is an `i32`. Write
// `toI32(2)`, or annotate nothing and let the field be a `number`.
// `tests/run.js --parity` found stage1 threading the field type down here
// (WP19 §A2).
interface IoError {
  code: i32;
  path: string;
}

export function main(): i32 {
  const problem: IoError = { code: 2, path: "/tmp" };
  return problem.code;
}
