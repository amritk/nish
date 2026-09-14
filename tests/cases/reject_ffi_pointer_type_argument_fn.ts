// WP27 S2 x WP18: a `CPtr` as the type argument of a generic *function*, which
// is the position the rule in `instantiate` is actually written for and the only
// one that reaches it. Its sibling `reject_ffi_pointer_type_argument` asks for
// `Box<CPtr>`, and a generic class monomorphises through `instantiateStruct`,
// which carries no `CPtr` check in either compiler -- so that case is refused by
// the *field* rule instead, and the "cannot be a type argument of" sentence was
// implemented twice and reached by nothing. All six positions interpolate into
// one shared fragment and so share one code, which is why the coverage tool was
// satisfied without it.
//
// A type argument cannot be written at the call (WP18 infers it), so `id(p)` is
// how `T` becomes `CPtr`: the refusal is spanned on the call, and both compilers
// span it there. The `.err` pins the caret run as well as the sentence, and
// `tests/run.js` compares this case's `--json` objects between the two
// compilers, for the reasons `reject_ffi_pointer_array` gives at length.
declare function handle(): CPtr;

const id = <T>(x: T): T => x;

export const main = (): i32 => {
  const p = handle();
  const q = id(p);
  return 0;
};
