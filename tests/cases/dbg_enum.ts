// WP23: an enum is an `i32` with names attached, which is what DWARF's
// `DW_TAG_enumeration_type` is for, so the golden carries one `DIEnumerator`
// per member and a debugger prints `While` rather than `2`. The distinctness
// the checker enforces survives into the debugger that way.
//
// Written in the legacy `function` spelling, as its two `dbg_*` neighbours
// are: stage0 and stage1 disagree about the *column* a `DILocation` takes for
// an arrow-declared function, which is a WP22 gap this case has no business
// pinning (see `dbg_locals`, `dbg_result`).
enum Kind {
  If = 1,
  While = 2,
  Return = 3,
}

function weight(k: Kind): i32 {
  const w: Kind = k;
  switch (w) {
    case Kind.If:
      return 10;
    case Kind.While:
      return 20;
    default:
      return 30;
  }
}

export function test(): number {
  return weight(Kind.While);
}
