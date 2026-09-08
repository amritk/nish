// WP17: `-g` describes a `Result` from `resultLayout` rather than as an opaque
// pointer, so the golden carries a `DW_TAG_structure_type` with `ok`, `value`
// and `error` at their byte offsets. A slot the ABI packs into a register — a
// return or a parameter — is described as the packed shape the C header
// declares instead: a 32-bit discriminant and a `DW_TAG_union_type` of the two
// arms, because a pointer there would name a value that is not in the
// register.
function half(n: i32): Result<i32, i32> {
  if (n % 2 !== 0) {
    return Err(n);
  }
  return Ok(n / 2);
}

function tag(path: string): Result<i32, string> {
  if (path === "") {
    return Err("empty");
  }
  return Ok(path.length);
}

// A `Result` parameter is packed too, so its `DILocalVariable` is the word
// rather than a pointer that is not in the register.
function score(r: Result<i32, i32>): i32 {
  if (r.isErr()) {
    return 0;
  }
  return r.value;
}

function test(): number {
  const r = half(8);
  const named = tag("abc");
  if (r.isErr() || named.isErr()) {
    return -1;
  }
  return score(r) + named.value;
}
