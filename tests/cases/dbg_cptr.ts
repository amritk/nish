// WP27 §7a under WP10 `-g`: debug info is the one path that has to say
// something about a type it has no structure for. A `CPtr` is `i8*` and this
// compiler laid out nothing behind it, so its `DILocalVariable` names a
// pointer with no pointee — `baseType: null`, which is what clang writes for
// `void *`. Describing it as a pointer to `char`, the shape `i8*` happens to
// share with a string, would have a debugger print a foreign address as text.
//
// No `-g` case named a `CPtr` before this one, and each compiler was wrong in
// its own way: stage0 wrote `!N = undefined`, which `llvm-as` rejects, and
// stage1 exited 70 on the missing basic type. Only `node tests/run.js --parity`
// could see it, because that mode compiles the whole corpus under `-g` whether
// or not a case asked to be; this case asks.
declare function malloc(size: u64): CPtr | null;
declare function free(block: CPtr): void;

export const test = (): number => {
  const block = malloc(32);
  if (block === null) {
    return 1;
  }
  // `block` is `CPtr | null` and `held` is `CPtr`, and both `DILocalVariable`s
  // name the one `DW_TAG_pointer_type`: `typeRef` strips the nullability first
  // and the foreign pointer is emitted once per module.
  const held = block;
  free(held);
  return 0;
};
